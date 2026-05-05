import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '../services/ConfigService';
import { FileSystemService } from '../services/FileSystemService';
import { TaskManagerService } from '../services/TaskManagerService';
import { logger } from '../utils/logger';
import { openExternalTerminal } from '../utils/externalTerminal';
import {
  TaskDocumentUpload,
  TaskFigmaNodeSelectionRequest,
  TaskFigmaSyncRequest,
  TaskItemCreateRequest,
  TaskItemDeleteRequest,
  TaskItemSelectRequest,
  TaskItemType,
  TaskJiraOpenRequest,
  TaskJiraReadRequest,
  TaskMarkdownRequest,
  TaskMarkdownRunRequest,
  TaskMarkdownUpdateRequest,
  TaskManagerMode
} from '../models/TaskManager';
import { getTaskManagerContent } from './taskManagerContent';

export class TaskManagerPanel {
  public static currentPanel: TaskManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private taskManagerService: TaskManagerService;
  private mode: TaskManagerMode;
  private currentItemId?: string;
  private currentItemType?: TaskItemType;
  private activeClaudeRunCleanup?: () => void;

  public static createOrShow(
    extensionUri: vscode.Uri,
    configService?: ConfigService,
    mode: TaskManagerMode = 'task',
    storageUri?: vscode.Uri
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TaskManagerPanel.currentPanel) {
      TaskManagerPanel.currentPanel._panel.reveal(column);
      TaskManagerPanel.currentPanel.setMode(mode);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'agentkitTaskManager',
      'AgentKit Task Manager',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    TaskManagerPanel.currentPanel = new TaskManagerPanel(panel, extensionUri, configService, mode, storageUri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    configService?: ConfigService,
    mode: TaskManagerMode = 'task',
    storageUri?: vscode.Uri
  ) {
    this._panel = panel;
    this.mode = mode;
    this.taskManagerService = new TaskManagerService(configService, new FileSystemService(), storageUri, extensionUri);

    this._panel.webview.html = getTaskManagerContent(this.mode);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'getTaskManagerState':
            await this.handleGetTaskManagerState(message.data?.mode, message.data?.itemId, message.data?.itemType);
            break;
          case 'setTaskMode':
            await this.handleSetTaskMode(message.data?.mode);
            break;
          case 'createTaskItem':
            await this.handleCreateTaskItem(message.data);
            break;
          case 'selectTaskItem':
            await this.handleSelectTaskItem(message.data);
            break;
          case 'deleteTaskItem':
            await this.handleDeleteTaskItem(message.data);
            break;
          case 'uploadTaskDocument':
            await this.handleUploadTaskDocument(message.data);
            break;
          case 'syncFigmaTaskLink':
            await this.handleSyncFigmaTaskLink(message.data);
            break;
          case 'updateFigmaNodeSelection':
            await this.handleUpdateFigmaNodeSelection(message.data);
            break;
          case 'copyFigmaNodeTitle':
            await this.handleCopyFigmaNodeTitle(message.data?.title);
            break;
          case 'getTaskMarkdown':
            await this.handleGetTaskMarkdown(message.data);
            break;
          case 'updateTaskMarkdown':
            await this.handleUpdateTaskMarkdown(message.data);
            break;
          case 'runTaskMarkdown':
            await this.handleRunTaskMarkdown(message.data);
            break;
          case 'openJiraInChrome':
            await this.handleOpenJiraInChrome(message.data);
            break;
          case 'readJiraTicket':
            await this.handleReadJiraTicket(message.data);
            break;
          case 'openTaskDocument':
            await this.handleOpenTaskDocument(message.data?.workspacePath);
            break;
          case 'cancel':
            this._panel.dispose();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async setMode(mode: TaskManagerMode): Promise<void> {
    this.mode = mode;
    this.currentItemId = undefined;
    this.currentItemType = undefined;
    this._panel.webview.postMessage({
      command: 'taskModeChanged',
      data: { mode }
    });
    await this.postTaskManagerState();
  }

  private async handleSetTaskMode(mode?: TaskManagerMode): Promise<void> {
    if (mode !== 'task' && mode !== 'fix-bug') {
      return;
    }

    await this.setMode(mode);
  }

  private async handleGetTaskManagerState(
    mode?: TaskManagerMode,
    itemId?: string,
    itemType?: TaskItemType
  ): Promise<void> {
    if (mode === 'task' || mode === 'fix-bug') {
      this.mode = mode;
    }

    if (itemId && (itemType === 'task' || itemType === 'bug')) {
      this.currentItemId = itemId;
      this.currentItemType = itemType;
    } else {
      this.currentItemId = undefined;
      this.currentItemType = undefined;
    }

    await this.postTaskManagerState();
  }

  private async postTaskManagerState(): Promise<void> {
    try {
      const state = await this.taskManagerService.getState(this.mode, {
        itemId: this.currentItemId,
        itemType: this.currentItemType
      });
      this._panel.webview.postMessage({
        command: 'taskManagerState',
        data: state
      });
    } catch (error) {
      logger.error('Error loading task manager state', error as Error);
      vscode.window.showErrorMessage(`Task Manager Error: ${(error as Error).message}`);
    }
  }

  private applyStateContext(state: { mode: TaskManagerMode; currentItem?: { id: string; type: TaskItemType } }): void {
    this.mode = state.mode;

    if (state.currentItem) {
      this.currentItemId = state.currentItem.id;
      this.currentItemType = state.currentItem.type;
    }
  }

  private async handleCreateTaskItem(request?: TaskItemCreateRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.createTaskItem(request);
      this.mode = result.state.mode;
      this.currentItemId = result.item.id;
      this.currentItemType = result.item.type;
      this._panel.webview.postMessage({
        command: 'taskItemCreateComplete',
        data: result
      });
      vscode.window.showInformationMessage(`Created ${result.item.type === 'bug' ? 'bug' : 'task'} ${result.item.id}`);
    } catch (error) {
      logger.error('Error creating task item', error as Error);
      this._panel.webview.postMessage({
        command: 'taskItemCreateFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleSelectTaskItem(request?: TaskItemSelectRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.selectTaskItem(request);
      this.mode = result.state.mode;
      this.currentItemId = result.item.id;
      this.currentItemType = result.item.type;
      this._panel.webview.postMessage({
        command: 'taskItemSelectComplete',
        data: result
      });
    } catch (error) {
      logger.error('Error selecting task item', error as Error);
      this._panel.webview.postMessage({
        command: 'taskItemSelectFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleDeleteTaskItem(request?: TaskItemDeleteRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.deleteTaskItem(request);
      this.currentItemId = undefined;
      this.currentItemType = undefined;
      this._panel.webview.postMessage({
        command: 'taskItemDeleteComplete',
        data: result
      });
      vscode.window.showInformationMessage(`Deleted ${request.type === 'bug' ? 'bug' : 'task'} ${request.id}`);
    } catch (error) {
      logger.error('Error deleting task item', error as Error);
      this._panel.webview.postMessage({
        command: 'taskItemDeleteFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleUploadTaskDocument(upload?: TaskDocumentUpload): Promise<void> {
    if (!upload) {
      return;
    }

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Importing task document',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Converting with markitdown...' });
          const importResult = await this.taskManagerService.importDocument({
            ...upload,
            mode: upload.mode || this.mode,
            itemId: upload.itemId || this.currentItemId,
            itemType: upload.itemType || this.currentItemType
          });
          progress.report({ increment: 100 });
          return importResult;
        }
      );

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'taskDocumentUploadComplete',
        data: result
      });
      vscode.window.showInformationMessage(`Imported ${result.document.name}`);
    } catch (error) {
      logger.error('Error importing task document', error as Error);
      this._panel.webview.postMessage({
        command: 'taskDocumentUploadFailed',
        data: { message: (error as Error).message }
      });
      vscode.window.showErrorMessage(`Task document import failed: ${(error as Error).message}`);
    }
  }

  private async handleSyncFigmaTaskLink(request?: TaskFigmaSyncRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Syncing Figma link',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Connecting to Figma...' });
          const syncResult = await this.taskManagerService.syncFigmaLink({
            ...request,
            mode: request.mode || this.mode,
            itemId: request.itemId || this.currentItemId,
            itemType: request.itemType || this.currentItemType
          });
          progress.report({ increment: 100 });
          return syncResult;
        }
      );

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'figmaTaskLinkSyncComplete',
        data: result
      });
      vscode.window.showInformationMessage(`Connected Figma file: ${result.connection.fileName}`);
    } catch (error) {
      logger.error('Error syncing Figma link', error as Error);
      this._panel.webview.postMessage({
        command: 'figmaTaskLinkSyncFailed',
        data: { message: (error as Error).message }
      });
      vscode.window.showErrorMessage(`Figma sync failed: ${(error as Error).message}`);
    }
  }

  private async handleUpdateFigmaNodeSelection(request?: TaskFigmaNodeSelectionRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.updateFigmaNodeSelection({
        ...request,
        mode: request.mode || this.mode,
        itemId: request.itemId || this.currentItemId,
        itemType: request.itemType || this.currentItemType
      });

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'figmaNodeSelectionUpdated',
        data: result
      });
    } catch (error) {
      logger.error('Error updating Figma node selection', error as Error);
      this._panel.webview.postMessage({
        command: 'figmaNodeSelectionFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleCopyFigmaNodeTitle(title?: string): Promise<void> {
    const cleanTitle = String(title || '').trim();

    if (!cleanTitle) {
      this._panel.webview.postMessage({
        command: 'figmaNodeTitleCopyFailed',
        data: { message: 'No Figma node title to copy.' }
      });
      return;
    }

    try {
      await vscode.env.clipboard.writeText(cleanTitle);
      this._panel.webview.postMessage({
        command: 'figmaNodeTitleCopied',
        data: { title: cleanTitle }
      });
    } catch (error) {
      logger.error('Error copying Figma node title', error as Error);
      this._panel.webview.postMessage({
        command: 'figmaNodeTitleCopyFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleGetTaskMarkdown(request?: TaskMarkdownRequest): Promise<void> {
    try {
      const result = await this.taskManagerService.getTaskMarkdown({
        ...request,
        mode: request?.mode || this.mode,
        itemId: request?.itemId || this.currentItemId,
        itemType: request?.itemType || this.currentItemType
      });

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'taskMarkdownLoaded',
        data: result
      });
    } catch (error) {
      logger.error('Error loading task markdown', error as Error);
      this._panel.webview.postMessage({
        command: 'taskMarkdownFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleUpdateTaskMarkdown(request?: TaskMarkdownUpdateRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.updateTaskMarkdown({
        ...request,
        mode: request.mode || this.mode,
        itemId: request.itemId || this.currentItemId,
        itemType: request.itemType || this.currentItemType
      });

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'taskMarkdownUpdated',
        data: result
      });
    } catch (error) {
      logger.error('Error updating task markdown', error as Error);
      this._panel.webview.postMessage({
        command: 'taskMarkdownFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async handleRunTaskMarkdown(request?: TaskMarkdownRunRequest): Promise<void> {
    const content = String(request?.content || '').trim();

    if (!content) {
      this._panel.webview.postMessage({
        command: 'taskMarkdownRunFailed',
        data: { message: 'No markdown brief to run.' }
      });
      return;
    }

    try {
      const result = await this.taskManagerService.updateTaskMarkdown({
        content,
        mode: request?.mode || this.mode,
        itemId: request?.itemId || this.currentItemId,
        itemType: request?.itemType || this.currentItemType
      });
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const markdownPath = result.state.currentItem?.markdownPath;

      if (!workspaceFolder) {
        throw new Error('No workspace folder open');
      }

      if (!markdownPath) {
        throw new Error('Saved markdown brief path was not found.');
      }

      this.applyStateContext(result.state);
      await this.openClaudeCodeTerminal(workspaceFolder, markdownPath, result.state.currentItem?.id);

      try {
        await vscode.env.clipboard.writeText(content);
      } catch (clipboardError) {
        logger.warn(`Unable to copy markdown brief while opening Claude Code: ${(clipboardError as Error).message}`);
      }

      this._panel.webview.postMessage({
        command: 'taskMarkdownRunStarted',
        data: {
          state: result.state,
          markdownPath,
          message: `Claude Code terminal opened with ${markdownPath}.`
        }
      });
      vscode.window.showInformationMessage('AgentKit: Claude Code terminal opened.');
    } catch (error) {
      logger.error('Error running task markdown', error as Error);
      this._panel.webview.postMessage({
        command: 'taskMarkdownRunFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  private async openClaudeCodeTerminal(
    workspaceFolder: vscode.Uri,
    markdownPath: string,
    itemId?: string
  ): Promise<void> {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'agentkit-claude-run-'));
    const donePath = path.join(tempDir, 'done.flag');
    const scriptPath = await this.createClaudeRunScript(tempDir, donePath, workspaceFolder, markdownPath, itemId);

    this.disposeActiveClaudeRun();
    this.watchClaudeRunDone(donePath, tempDir, markdownPath);

    try {
      await openExternalTerminal(scriptPath);
    } catch (error) {
      this.disposeActiveClaudeRun();
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
      throw error;
    }
  }

  private async createClaudeRunScript(
    tempDir: string,
    donePath: string,
    workspaceFolder: vscode.Uri,
    markdownPath: string,
    itemId?: string
  ): Promise<string> {
    const claudeCommand = this.getClaudeCodeCommand(markdownPath);
    const cwd = workspaceFolder.fsPath.replace(/\\/g, '/');
    const bashDonePath = donePath.replace(/\\/g, '/');
    const title = itemId ? `AgentKit Claude Code: ${itemId}` : 'AgentKit Claude Code';

    const bashScript = `#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$PATH"
cd "${cwd}"
${claudeCommand}
status=$?
: > "${bashDonePath}"
exit $status
`;

    const bashScriptPath = path.join(tempDir, 'run-claude.sh');
    await fsPromises.writeFile(bashScriptPath, bashScript, 'utf8');

    if (process.platform !== 'win32') {
      await fsPromises.chmod(bashScriptPath, 0o755);
      return bashScriptPath;
    }

    const bashPath = this.getBashShellPath();
    const wrapperPath = path.join(tempDir, 'run-claude.cmd');
    const wrapper = `@echo off\r\ntitle ${title}\r\n"${bashPath}" "${bashScriptPath}"\r\n`;
    await fsPromises.writeFile(wrapperPath, wrapper, 'utf8');
    return wrapperPath;
  }

  private watchClaudeRunDone(donePath: string, tempDir: string, markdownPath: string): void {
    let fired = false;
    const interval = setInterval(async () => {
      try {
        await fsPromises.access(donePath);
      } catch {
        return;
      }

      if (fired) {
        return;
      }
      fired = true;
      clearInterval(interval);
      this.activeClaudeRunCleanup = undefined;

      this._panel.webview.postMessage({
        command: 'taskMarkdownRunStopped',
        data: {
          markdownPath,
          message: 'Claude Code terminal closed.'
        }
      });

      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }, 1000);

    this.activeClaudeRunCleanup = () => {
      clearInterval(interval);
    };
  }

  private disposeActiveClaudeRun(): void {
    this.activeClaudeRunCleanup?.();
    this.activeClaudeRunCleanup = undefined;
  }

  private getBashShellPath(): string {
    const configuredBashPath = process.env.CLAUDE_CODE_GIT_BASH_PATH;

    if (configuredBashPath && fs.existsSync(configuredBashPath)) {
      return configuredBashPath;
    }

    if (process.platform !== 'win32') {
      const shell = process.env.SHELL || '';
      if (path.basename(shell) === 'bash' && fs.existsSync(shell)) {
        return shell;
      }

      for (const candidate of ['/bin/bash', '/usr/bin/bash']) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      return 'bash';
    }

    const windowsCandidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'bash.exe'),
      process.env['ProgramFiles(x86)']
        ? path.join(process.env['ProgramFiles(x86)'] as string, 'Git', 'bin', 'bash.exe')
        : undefined,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')
        : undefined
    ].filter((candidate): candidate is string => Boolean(candidate));

    return windowsCandidates.find(candidate => fs.existsSync(candidate)) || 'bash.exe';
  }

  private getClaudeCodeCommand(markdownPath: string): string {
    const normalizedMarkdownPath = markdownPath.replace(/\\/g, '/');
    const prompt = [
      `Read the AgentKit markdown brief at ${normalizedMarkdownPath}.`,
      'Implement the requested coding work in this workspace.',
      'Keep changes scoped to the brief, run relevant verification, and summarize what changed.'
    ].join(' ');

    return `claude ${this.quoteShellArgument(prompt)}`;
  }

  private quoteShellArgument(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private async handleOpenJiraInChrome(request?: TaskJiraOpenRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Opening Jira in Chrome',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Starting Playwright Chrome...' });
          const openResult = await this.taskManagerService.openJiraInChrome({
            ...request,
            mode: request.mode || this.mode,
            itemId: request.itemId || this.currentItemId,
            itemType: request.itemType || this.currentItemType
          });
          progress.report({ increment: 100 });
          return openResult;
        }
      );

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'jiraOpenComplete',
        data: result
      });
      vscode.window.showInformationMessage('Jira opened in Playwright Chrome. Log in there if needed.');
    } catch (error) {
      logger.error('Error opening Jira in Chrome', error as Error);
      this._panel.webview.postMessage({
        command: 'jiraOpenFailed',
        data: { message: (error as Error).message }
      });
      vscode.window.showErrorMessage(`Jira open failed: ${(error as Error).message}`);
    }
  }

  private async handleReadJiraTicket(request?: TaskJiraReadRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Reading Jira ticket',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Reading Jira page content...' });
          const readResult = await this.taskManagerService.readJiraTicket({
            ...request,
            mode: request.mode || this.mode,
            itemId: request.itemId || this.currentItemId,
            itemType: request.itemType || this.currentItemType
          });
          progress.report({ increment: 100 });
          return readResult;
        }
      );

      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'jiraReadComplete',
        data: result
      });
      vscode.window.showInformationMessage(
        `Read Jira ticket, saved markdown, and closed Chrome: ${result.connection.ticket?.title || result.connection.link}`
      );
    } catch (error) {
      logger.error('Error reading Jira ticket', error as Error);
      this._panel.webview.postMessage({
        command: 'jiraReadFailed',
        data: { message: (error as Error).message }
      });
      vscode.window.showErrorMessage(`Jira read failed: ${(error as Error).message}`);
    }
  }

  private async handleOpenTaskDocument(workspacePath?: string): Promise<void> {
    if (!workspacePath) {
      return;
    }

    try {
      await this.taskManagerService.openDocument(workspacePath);
    } catch (error) {
      logger.error('Error opening task document', error as Error);
      vscode.window.showErrorMessage(`Failed to open task document: ${(error as Error).message}`);
    }
  }

  public dispose(): void {
    TaskManagerPanel.currentPanel = undefined;
    this.disposeActiveClaudeRun();
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
