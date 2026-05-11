import * as vscode from 'vscode';
import * as fs from 'fs/promises';
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
import { getWorkflowSettingsHtml, makeNonce } from './webview/content';

type Locator =
  | { type: 'root'; index: number }
  | { type: 'parallel-child'; parentIndex: number; childIndex: number };

export class WorkflowSettingsPanel {
  public static currentPanel: WorkflowSettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly storage = new WorkflowStorageService();
  private disposables: vscode.Disposable[] = [];
  private workflows: WorkflowFile[] = [];
  private activeId: string | null = null;

  public static createOrShow(): void {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (WorkflowSettingsPanel.currentPanel) {
      WorkflowSettingsPanel.currentPanel.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'NWAWorkflowSettings',
      'NWA Settings',
      column ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    WorkflowSettingsPanel.currentPanel = new WorkflowSettingsPanel(panel);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = getWorkflowSettingsHtml(makeNonce());
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(msg => this.onMessage(msg), null, this.disposables);
  }

  private async onMessage(msg: { command: string; data?: any }): Promise<void> {
    try {
      switch (msg.command) {
        case 'ready':
          await this.loadAll();
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
      vscode.window.showErrorMessage(`Workflow error: ${(err as Error).message}`);
    }
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
