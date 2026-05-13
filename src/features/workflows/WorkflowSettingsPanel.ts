import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConfigService } from '../../services/ConfigService';
import { COMMANDS } from '../../utils/constants';
import { WorkflowStorageService } from './WorkflowStorageService';
import { parseWorkflow, stringifyWorkflow } from './yaml';
import {
  STEP_OPTIONS,
  WORKFLOW_FILE_VERSION,
  WorkflowBlock,
  WorkflowFile,
  WorkflowParallelBlock,
  WorkflowStepBlock
} from './types';
import { FIGMA_ACCESS_TOKEN_SECRET_KEY, getCoreSavePathSettings } from './settingsData';
import { getWorkflowSettingsHtml, makeNonce } from './webview/content';

type Locator =
  | { type: 'root'; index: number }
  | { type: 'parallel-child'; parentIndex: number; childIndex: number };

type CliToolId = 'claude' | 'codex';

interface CliToolStatus {
  id: CliToolId;
  label: string;
  installed: boolean;
  authenticated: boolean;
  version?: string;
  message?: string;
}

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  message?: string;
}

const execFileAsync = promisify(execFile);

export class WorkflowSettingsPanel {
  public static currentPanel: WorkflowSettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly storage = new WorkflowStorageService();
  private readonly configService: ConfigService;
  private readonly secretStorage?: vscode.SecretStorage;
  private disposables: vscode.Disposable[] = [];
  private workflows: WorkflowFile[] = [];
  private activeId: string | null = null;

  public static createOrShow(secretStorage?: vscode.SecretStorage, configService?: ConfigService): void {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (WorkflowSettingsPanel.currentPanel) {
      WorkflowSettingsPanel.currentPanel.panel.reveal(column);
      void WorkflowSettingsPanel.currentPanel.postCoreSettings();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'NWAWorkflowSettings',
      'NWA Settings',
      column ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    WorkflowSettingsPanel.currentPanel = new WorkflowSettingsPanel(panel, secretStorage, configService);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    secretStorage?: vscode.SecretStorage,
    configService?: ConfigService
  ) {
    this.panel = panel;
    this.secretStorage = secretStorage;
    this.configService = configService || new ConfigService();
    this.panel.webview.html = getWorkflowSettingsHtml(makeNonce());
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(msg => this.onMessage(msg), null, this.disposables);
  }

  private async onMessage(msg: { command: string; data?: any }): Promise<void> {
    try {
      switch (msg.command) {
        case 'ready':
          await this.postCoreSettings();
          await this.loadAll();
          break;
        case 'saveFigmaToken':
          await this.saveFigmaToken(msg.data?.token);
          break;
        case 'clearFigmaToken':
          await this.clearFigmaToken();
          break;
        case 'saveTaskDocumentsFolder':
          await this.saveTaskDocumentsFolder(msg.data?.value);
          break;
        case 'resetTaskDocumentsFolder':
          await this.resetTaskDocumentsFolder();
          break;
        case 'refreshCliStatus':
          await this.refreshCliStatus();
          break;
        case 'installCli':
          await this.installCli();
          break;
        case 'authenticateCli':
          await this.authenticateCli(msg.data?.id);
          break;
        case 'selectWorkflow':
          this.selectWorkflow(msg.data?.id);
          break;
        case 'createWorkflow':
          await this.createWorkflow();
          break;
        case 'renameWorkflow':
          await this.renameWorkflow(msg.data?.id);
          break;
        case 'renameWorkflowInline':
          await this.renameWorkflowInline(msg.data?.id, msg.data?.name);
          break;
        case 'deleteWorkflow':
          await this.deleteWorkflow(msg.data?.id);
          break;
        case 'addStep':
          await this.addStep(msg.data?.workflowId, msg.data?.locator);
          break;
        case 'addParallelGroup':
          await this.addParallelGroup(msg.data?.workflowId);
          break;
        case 'addParallelChild':
          await this.addParallelChild(msg.data?.workflowId, msg.data?.parentIndex);
          break;
        case 'deleteBlock':
          await this.deleteBlock(msg.data?.workflowId, msg.data?.locator);
          break;
        case 'validateWorkflow':
          await this.validateWorkflow(msg.data?.id);
          break;
        case 'importWorkflow':
          await this.importWorkflow();
          break;
        case 'exportWorkflow':
          await this.exportWorkflow(msg.data?.id);
          break;
      }
    } catch (err) {
      const statusId = this.getCoreSettingsStatusId(msg.command);
      if (statusId) {
        this.panel.webview.postMessage({
          command: 'coreSettingsError',
          statusId,
          message: (err as Error).message
        });
      }
      vscode.window.showErrorMessage(`Workflow error: ${(err as Error).message}`);
    }
  }

  private getCoreSettingsStatusId(command: string): string | undefined {
    if (command === 'saveFigmaToken' || command === 'clearFigmaToken') {
      return 'figma-token-status';
    }

    if (command === 'saveTaskDocumentsFolder' || command === 'resetTaskDocumentsFolder') {
      return 'save-path-status';
    }

    if (command === 'refreshCliStatus' || command === 'installCli' || command === 'authenticateCli') {
      return 'cli-status-status';
    }

    return undefined;
  }

  private async getCoreSettingsState(): Promise<{
    hasFigmaToken: boolean;
    savePaths: ReturnType<typeof getCoreSavePathSettings>;
    cliStatuses: CliToolStatus[];
  }> {
    const token = this.secretStorage
      ? await this.secretStorage.get(FIGMA_ACCESS_TOKEN_SECRET_KEY)
      : undefined;
    return {
      hasFigmaToken: Boolean(token),
      savePaths: getCoreSavePathSettings(this.configService.getTaskDocumentsFolder()),
      cliStatuses: await this.getCliStatuses()
    };
  }

  private async postCoreSettings(): Promise<void> {
    this.panel.webview.postMessage({
      command: 'setCoreSettings',
      data: await this.getCoreSettingsState()
    });
  }

  private async postCoreSettingsSaved(statusId: string, message: string): Promise<void> {
    this.panel.webview.postMessage({
      command: 'coreSettingsSaved',
      data: await this.getCoreSettingsState(),
      statusId,
      message
    });
  }

  private async getCliStatuses(): Promise<CliToolStatus[]> {
    return Promise.all([
      this.getCliStatus('claude'),
      this.getCliStatus('codex')
    ]);
  }

  private async getCliStatus(id: CliToolId): Promise<CliToolStatus> {
    const label = id === 'claude' ? 'Claude Code CLI' : 'Codex CLI';
    const command = id === 'claude' ? 'claude' : 'codex';
    const version = await this.runCliCommand(command, ['--version']);

    if (!version.ok) {
      return {
        id,
        label,
        installed: false,
        authenticated: false,
        message: id === 'claude'
          ? 'Run Init env to install the Claude Code CLI.'
          : 'Run Init env to install the Codex CLI.'
      };
    }

    const authStatus = id === 'claude'
      ? await this.getClaudeAuthStatus()
      : await this.getCodexAuthStatus();

    return {
      id,
      label,
      installed: true,
      authenticated: authStatus.authenticated,
      version: this.firstOutputLine(version.stdout || version.stderr),
      message: authStatus.message
    };
  }

  private async getClaudeAuthStatus(): Promise<{ authenticated: boolean; message: string }> {
    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      return { authenticated: true, message: 'ANTHROPIC_API_KEY is available in the extension host environment.' };
    }

    const result = await this.runCliCommand('claude', ['auth', 'status']);
    if (!result.ok) {
      return { authenticated: false, message: this.firstOutputLine(result.stderr || result.stdout || result.message) || 'Claude auth status is unavailable.' };
    }

    try {
      const payload = JSON.parse(result.stdout) as { loggedIn?: boolean; authMethod?: string; subscriptionType?: string };
      if (payload.loggedIn) {
        const details = [payload.authMethod, payload.subscriptionType].filter(Boolean).join(' / ');
        return { authenticated: true, message: details ? `Signed in via ${details}.` : 'Claude is signed in.' };
      }
    } catch {
      if (/logged\s*in|authenticated|signed\s*in/i.test(result.stdout)) {
        return { authenticated: true, message: this.firstOutputLine(result.stdout) || 'Claude is signed in.' };
      }
    }

    return { authenticated: false, message: 'Run Claude authentication to sign in.' };
  }

  private async getCodexAuthStatus(): Promise<{ authenticated: boolean; message: string }> {
    if (process.env.OPENAI_API_KEY?.trim()) {
      return { authenticated: true, message: 'OPENAI_API_KEY is available in the extension host environment.' };
    }

    const result = await this.runCliCommand('codex', ['login', 'status']);
    if (result.ok) {
      return { authenticated: true, message: this.firstOutputLine(result.stdout || result.stderr) || 'Codex is signed in.' };
    }

    return {
      authenticated: false,
      message: this.firstOutputLine(result.stdout || result.stderr || result.message) || 'Run Codex authentication to sign in.'
    };
  }

  private async runCliCommand(command: string, args: string[]): Promise<CommandResult> {
    try {
      const result = await execFileAsync(command, args, {
        timeout: 10000,
        shell: process.platform === 'win32'
      });
      return {
        ok: true,
        stdout: String(result.stdout || '').trim(),
        stderr: String(result.stderr || '').trim()
      };
    } catch (error) {
      const commandError = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
      return {
        ok: false,
        stdout: String(commandError.stdout || '').trim(),
        stderr: String(commandError.stderr || '').trim(),
        message: commandError.message
      };
    }
  }

  private firstOutputLine(value: string | undefined): string {
    return String(value || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  }

  private async refreshCliStatus(): Promise<void> {
    await this.postCoreSettingsSaved('cli-status-status', 'CLI status refreshed.');
  }

  private async installCli(): Promise<void> {
    await vscode.commands.executeCommand(COMMANDS.INIT_CLAUDE_ENVIRONMENT);
    await this.postCoreSettingsSaved('cli-status-status', 'Init env completed. CLI status refreshed.');
  }

  private async authenticateCli(id: CliToolId | undefined): Promise<void> {
    const toolId = this.normalizeCliToolId(id);
    const command = toolId === 'claude' ? 'claude auth login' : 'codex login';
    const label = toolId === 'claude' ? 'Claude Code CLI' : 'Codex CLI';
    const terminal = vscode.window.createTerminal(`NWA ${label} Auth`);
    terminal.show(true);
    terminal.sendText(command, true);
    await this.postCoreSettingsSaved('cli-status-status', `${label} authentication opened in the terminal. Refresh after it completes.`);
  }

  private normalizeCliToolId(id: string | undefined): CliToolId {
    if (id === 'claude' || id === 'codex') {
      return id;
    }

    throw new Error('Unknown CLI tool.');
  }

  private async saveFigmaToken(token: string | undefined): Promise<void> {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      throw new Error('Paste a Figma access token before saving.');
    }

    if (!this.secretStorage) {
      throw new Error('VS Code secret storage is not available.');
    }

    await this.secretStorage.store(FIGMA_ACCESS_TOKEN_SECRET_KEY, cleanToken);
    await this.postCoreSettingsSaved('figma-token-status', 'Figma token saved.');
  }

  private async clearFigmaToken(): Promise<void> {
    if (!this.secretStorage) {
      throw new Error('VS Code secret storage is not available.');
    }

    await this.secretStorage.delete(FIGMA_ACCESS_TOKEN_SECRET_KEY);
    await this.postCoreSettingsSaved('figma-token-status', 'Figma token cleared.');
  }

  private normalizeWorkspaceRelativePath(value: string | undefined): string {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    if (
      !rawValue ||
      path.win32.isAbsolute(rawValue) ||
      path.posix.isAbsolute(rawValue) ||
      segments.length === 0 ||
      segments.includes('..')
    ) {
      throw new Error('Use a workspace-relative path without empty segments or "..".');
    }

    return segments.join('/');
  }

  private async saveTaskDocumentsFolder(value: string | undefined): Promise<void> {
    const normalizedPath = this.normalizeWorkspaceRelativePath(value);
    await this.configService.setTaskDocumentsFolder(normalizedPath);
    await this.postCoreSettingsSaved('save-path-status', 'Task documents path saved.');
  }

  private async resetTaskDocumentsFolder(): Promise<void> {
    await this.configService.setTaskDocumentsFolder(undefined);
    await this.postCoreSettingsSaved('save-path-status', 'Task documents path reset to the default.');
  }

  private postState(): void {
    this.panel.webview.postMessage({
      command: 'setState',
      data: { workflows: this.workflows, activeId: this.activeId }
    });
  }

  private async loadAll(): Promise<void> {
    this.workflows = await this.storage.listWorkflows();
    if (this.workflows.length === 0) {
      const wf = this.storage.newEmptyWorkflow('Standard');
      await this.storage.saveWorkflow(wf);
      this.workflows = [wf];
    }
    if (!this.activeId || !this.workflows.find(w => w.id === this.activeId)) {
      this.activeId = this.workflows[0].id;
    }
    this.postState();
  }

  private findWorkflow(id: string | undefined): WorkflowFile | undefined {
    return this.workflows.find(w => w.id === id);
  }

  private async createWorkflow(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'Workflow name',
      value: 'New Workflow',
      validateInput: v => (v && v.trim().length > 0 ? null : 'Name is required')
    });
    if (!name) {
      return;
    }
    const wf = this.storage.newEmptyWorkflow(name.trim());
    await this.storage.saveWorkflow(wf);
    this.workflows.push(wf);
    this.activeId = wf.id;
    this.postState();
  }

  private async renameWorkflow(id: string): Promise<void> {
    const wf = this.findWorkflow(id);
    if (!wf) {
      return;
    }
    const name = await vscode.window.showInputBox({
      prompt: 'Rename workflow',
      value: wf.name,
      validateInput: v => (v && v.trim().length > 0 ? null : 'Name is required')
    });
    if (!name || name.trim() === wf.name) {
      return;
    }
    const oldSnapshot: WorkflowFile = { ...wf, blocks: wf.blocks };
    wf.name = name.trim();
    await this.storage.renameWorkflow(oldSnapshot, wf);
    this.postState();
  }

  private async renameWorkflowInline(id: string, name: string): Promise<void> {
    const wf = this.findWorkflow(id);
    if (!wf || !name || name.trim() === wf.name) {
      return;
    }
    const oldSnapshot: WorkflowFile = { ...wf, blocks: wf.blocks };
    wf.name = name.trim();
    await this.storage.renameWorkflow(oldSnapshot, wf);
    this.postState();
  }

  private async deleteWorkflow(id: string): Promise<void> {
    const wf = this.findWorkflow(id);
    if (!wf) {
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Delete workflow "${wf.name}"?`,
      { modal: true },
      'Delete'
    );
    if (choice !== 'Delete') {
      return;
    }
    await this.storage.deleteWorkflow(wf);
    this.workflows = this.workflows.filter(w => w.id !== id);
    if (this.activeId === id) {
      this.activeId = this.workflows[0]?.id ?? null;
    }
    this.postState();
  }

  private async pickStep(): Promise<WorkflowStepBlock | undefined> {
    const picked = await vscode.window.showQuickPick(
      STEP_OPTIONS.map(o => ({ label: o.label, description: o.description, stepType: o.stepType })),
      { placeHolder: 'Select a step type', matchOnDescription: true }
    );
    if (!picked) {
      return undefined;
    }
    return {
      id: this.newBlockId(),
      kind: 'step',
      stepType: picked.stepType,
      title: picked.label,
      status: 'idle'
    };
  }

  private newBlockId(): string {
    return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private newWorkflowId(): string {
    return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  private workflowNameSlug(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return base || 'workflow';
  }

  private makeUniqueWorkflowName(name: string): string {
    const baseName = name.trim() || 'Imported Workflow';
    const existingSlugs = new Set(this.workflows.map(w => this.workflowNameSlug(w.name)));
    if (!existingSlugs.has(this.workflowNameSlug(baseName))) {
      return baseName;
    }

    let suffix = 2;
    let candidate = `${baseName} ${suffix}`;
    while (existingSlugs.has(this.workflowNameSlug(candidate))) {
      suffix++;
      candidate = `${baseName} ${suffix}`;
    }
    return candidate;
  }

  private cloneImportedBlocks(blocks: WorkflowBlock[]): WorkflowBlock[] {
    return blocks.map(block => {
      if (block.kind === 'step') {
        return {
          ...block,
          id: this.newBlockId(),
          status: 'idle'
        };
      }

      return {
        ...block,
        id: this.newBlockId(),
        status: 'idle',
        children: block.children.map(child => ({
          ...child,
          id: this.newBlockId(),
          status: 'idle'
        }))
      };
    });
  }

  private prepareImportedWorkflow(wf: WorkflowFile): WorkflowFile {
    return {
      version: WORKFLOW_FILE_VERSION,
      id: this.newWorkflowId(),
      name: this.makeUniqueWorkflowName(wf.name),
      blocks: this.cloneImportedBlocks(wf.blocks)
    };
  }

  private async addStep(workflowId: string, locator: Locator): Promise<void> {
    const wf = this.findWorkflow(workflowId);
    if (!wf) {
      return;
    }
    const step = await this.pickStep();
    if (!step) {
      return;
    }
    if (locator.type === 'root') {
      wf.blocks.splice(locator.index + 1, 0, step);
    } else {
      // not used (parallel children appended via addParallelChild)
      const parent = wf.blocks[locator.parentIndex];
      if (parent && parent.kind === 'parallel') {
        parent.children.splice(locator.childIndex + 1, 0, step);
      }
    }
    await this.storage.saveWorkflow(wf);
    this.postState();
  }

  private async addParallelGroup(workflowId: string): Promise<void> {
    const wf = this.findWorkflow(workflowId);
    if (!wf) {
      return;
    }
    const first = await this.pickStep();
    if (!first) {
      return;
    }
    const group: WorkflowParallelBlock = {
      id: this.newBlockId(),
      kind: 'parallel',
      title: 'Parallel',
      status: 'idle',
      children: [first]
    };
    wf.blocks.push(group);
    await this.storage.saveWorkflow(wf);
    this.postState();
  }

  private async addParallelChild(workflowId: string, parentIndex: number): Promise<void> {
    const wf = this.findWorkflow(workflowId);
    if (!wf) {
      return;
    }
    const parent = wf.blocks[parentIndex];
    if (!parent || parent.kind !== 'parallel') {
      return;
    }
    const step = await this.pickStep();
    if (!step) {
      return;
    }
    parent.children.push(step);
    await this.storage.saveWorkflow(wf);
    this.postState();
  }

  private async deleteBlock(workflowId: string, locator: Locator): Promise<void> {
    const wf = this.findWorkflow(workflowId);
    if (!wf) {
      return;
    }
    if (locator.type === 'root') {
      wf.blocks.splice(locator.index, 1);
    } else {
      const parent = wf.blocks[locator.parentIndex];
      if (parent && parent.kind === 'parallel') {
        parent.children.splice(locator.childIndex, 1);
        if (parent.children.length === 0) {
          wf.blocks.splice(locator.parentIndex, 1);
        }
      }
    }
    await this.storage.saveWorkflow(wf);
    this.postState();
  }

  private selectWorkflow(id: string | undefined): void {
    if (!id || !this.findWorkflow(id)) {
      return;
    }
    this.activeId = id;
  }

  private async validateWorkflow(id: string): Promise<void> {
    const wf = this.findWorkflow(id);
    if (!wf) {
      return;
    }
    const filePath = await this.storage.saveWorkflow(wf);
    vscode.window.showInformationMessage(`Workflow "${wf.name}" validated and saved to ${filePath}`);
  }

  private async importWorkflow(): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { ['YAML']: ['yaml', 'yml'] },
      openLabel: 'Import workflow',
      title: 'Import workflow'
    });
    const source = selected?.[0];
    if (!source) {
      return;
    }

    const content = await fs.readFile(source.fsPath, 'utf8');
    const imported = this.prepareImportedWorkflow(parseWorkflow(content));
    const filePath = await this.storage.saveWorkflow(imported);
    this.workflows.push(imported);
    this.activeId = imported.id;
    this.postState();
    vscode.window.showInformationMessage(`Workflow "${imported.name}" imported to ${filePath}`);
  }

  private async exportWorkflow(id: string): Promise<void> {
    const wf = this.findWorkflow(id);
    if (!wf) {
      return;
    }
    const defaultName = `${wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'workflow'}.workflow.yaml`;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, defaultName)
      : vscode.Uri.file(defaultName);
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { ['YAML']: ['yaml', 'yml'] },
      saveLabel: 'Export workflow'
    });
    if (!target) {
      return;
    }
    await fs.writeFile(target.fsPath, stringifyWorkflow(wf), 'utf8');
    vscode.window.showInformationMessage(`Workflow exported to ${target.fsPath}`);
  }

  dispose(): void {
    WorkflowSettingsPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }
}
