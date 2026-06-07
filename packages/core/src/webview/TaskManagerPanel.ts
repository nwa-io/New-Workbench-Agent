import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { FileSystemService } from '../services/FileSystemService';
import { TaskManagerService } from '../services/TaskManagerService';
import { ClaudeCodeTerminalService } from '../features/taskManager/ClaudeCodeTerminalService';
import { FigmaBridgeDetailAction, FigmaBridgeDetailService } from '../features/taskManager/FigmaBridgeDetailService';
import { TaskWorkflowExecutionService } from '../features/taskManager/TaskWorkflowExecutionService';
import { ModelCatalogService } from '../features/workflows/ModelCatalogService';
import type { WorkflowStatus, WorkflowStepBlock } from '../features/workflows/types';
import type { ModelOption, TaskManagerState } from '../models/TaskManager';
import { logger } from '../utils/logger';
import {
  TaskDocumentUpload,
  TaskItemCreateRequest,
  TaskItemDeleteRequest,
  TaskItemSelectRequest,
  TaskItemType,
  TaskJiraOpenRequest,
  TaskJiraReadRequest,
  TaskMarkdownRequest,
  TaskMarkdownRunRequest,
  TaskMarkdownUpdateRequest,
  TaskWorkflowRunRequest,
  TaskWorkflowStepDoneRequest,
  TaskManagerMode
} from '../models/TaskManager';
import { renderWebviewHtml, webviewLocalResourceRoots } from './webviewHtml';

export class TaskManagerPanel {
  public static currentPanel: TaskManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private taskManagerService: TaskManagerService;
  private figmaBridgeDetailService: FigmaBridgeDetailService;
  private workflowExecutionService: TaskWorkflowExecutionService;
  private claudeCodeTerminalService = new ClaudeCodeTerminalService();
  private readonly modelCatalog = new ModelCatalogService();
  private availableModels: ModelOption[] | null = null;
  private mode: TaskManagerMode;
  private currentItemId?: string;
  private currentItemType?: TaskItemType;

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
      'NWATaskManager',
      'NWA Task Manager',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: webviewLocalResourceRoots(extensionUri)
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
    this.figmaBridgeDetailService = new FigmaBridgeDetailService(storageUri);
    this.workflowExecutionService = new TaskWorkflowExecutionService(this.taskManagerService, {
      onPrepared: data => this._panel.webview.postMessage({
        command: 'taskWorkflowRunPrepared',
        data
      }),
      onState: state => this.applyStateContext(state),
      onStatus: (blockId, status) => this.postTaskWorkflowStatus(blockId, status),
      onMessage: message => this._panel.webview.postMessage({
        command: 'taskWorkflowRunMessage',
        data: { message }
      })
    });

    this._panel.webview.html = renderWebviewHtml({
      webview: this._panel.webview,
      extensionUri,
      bundle: 'taskManager',
      title: 'NWA Task Manager',
      bootstrap: { mode: this.mode }
    });
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
          case 'getFigmaBridgeDetail':
            await this.handleFigmaBridgeDetail('refresh');
            break;
          case 'startFigmaMcpBridge':
            await this.handleFigmaBridgeDetail('start');
            break;
          case 'showFigmaMcpBridgeStatus':
            await this.handleFigmaBridgeDetail('show');
            break;
          case 'stopFigmaMcpBridge':
            await this.handleFigmaBridgeDetail('stop');
            break;
          case 'openFigmaDesktop':
            await this.handleOpenFigmaDesktop(message.data?.fileKey);
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
          case 'runTaskWorkflow':
            await this.handleRunTaskWorkflow(message.data);
            break;
          case 'markWorkflowStepDone':
            await this.handleMarkWorkflowStepDone(message.data);
            break;
          case 'setWorkflowStepModel':
            await this.handleSetWorkflowStepModel(message.data);
            break;
          case 'setWorkflowStepSpeed':
            await this.handleSetWorkflowStepSpeed(message.data);
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
    if (mode !== 'task' && mode !== 'fix-bug' && mode !== 'analysis') {
      return;
    }

    await this.setMode(mode);
  }

  private async handleGetTaskManagerState(
    mode?: TaskManagerMode,
    itemId?: string,
    itemType?: TaskItemType
  ): Promise<void> {
    if (mode === 'task' || mode === 'fix-bug' || mode === 'analysis') {
      this.mode = mode;
    }

    if (itemId && (itemType === 'task' || itemType === 'bug' || itemType === 'analysis')) {
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
      await this.postModelCatalog();
    } catch (error) {
      logger.error('Error loading task manager state', error as Error);
      vscode.window.showErrorMessage(`Task Manager Error: ${(error as Error).message}`);
    }
  }

  /** Auth-gated model list for the run-view dropdowns. Computed once, then cached. */
  private async postModelCatalog(): Promise<void> {
    if (!this.availableModels) {
      this.availableModels = await this.modelCatalog.getAvailableModels();
    }
    this._panel.webview.postMessage({
      command: 'taskModelCatalog',
      data: { availableModels: this.availableModels }
    });
  }

  private async handleSetWorkflowStepModel(
    request?: { stepId: string; model: string; speed?: string; mode?: TaskManagerMode; itemId?: string; itemType?: TaskItemType }
  ): Promise<void> {
    if (!request?.stepId) {
      return;
    }
    try {
      const result = await this.taskManagerService.setWorkflowStepModel(this.withTaskContext(request));
      this.applyStateContext(result.state);
      this._panel.webview.postMessage({ command: 'taskManagerState', data: result.state });
    } catch (error) {
      vscode.window.showErrorMessage(`Unable to set step model: ${(error as Error).message}`);
      await this.postTaskManagerState();
    }
  }

  private async handleSetWorkflowStepSpeed(
    request?: { stepId: string; speed: string; mode?: TaskManagerMode; itemId?: string; itemType?: TaskItemType }
  ): Promise<void> {
    if (!request?.stepId) {
      return;
    }
    try {
      const result = await this.taskManagerService.setWorkflowStepSpeed(this.withTaskContext(request));
      this.applyStateContext(result.state);
      this._panel.webview.postMessage({ command: 'taskManagerState', data: result.state });
    } catch (error) {
      vscode.window.showErrorMessage(`Unable to set step speed: ${(error as Error).message}`);
      await this.postTaskManagerState();
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
      vscode.window.showInformationMessage(`Created ${this.getTaskItemTypeLabel(result.item.type)} ${result.item.id}`);
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
      vscode.window.showInformationMessage(`Deleted ${this.getTaskItemTypeLabel(request.type)} ${request.id}`);
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
          title: 'Selecting task document',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Saving source file...' });
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
      vscode.window.showInformationMessage(`Selected ${result.document.name}`);
    } catch (error) {
      logger.error('Error selecting task document', error as Error);
      this._panel.webview.postMessage({
        command: 'taskDocumentUploadFailed',
        data: { message: (error as Error).message }
      });
      vscode.window.showErrorMessage(`Task document selection failed: ${(error as Error).message}`);
    }
  }

  private async handleOpenFigmaDesktop(fileKey?: string): Promise<void> {
    // Figma has no API to open a specific plugin tab, so we open the desktop app
    // (the file itself when we captured its key) and let the user run the plugin.
    const target = fileKey ? `figma://file/${encodeURIComponent(fileKey)}` : 'figma://';
    try {
      await vscode.env.openExternal(vscode.Uri.parse(target));
      vscode.window.showInformationMessage(
        'Opening Figma — run Plugins → Development → Figma Clarity, then Scan & Send to VS Code.'
      );
    } catch (error) {
      logger.error('Error opening Figma desktop', error as Error);
      vscode.window.showErrorMessage(`Unable to open Figma: ${(error as Error).message}`);
    }
  }

  private async handleFigmaBridgeDetail(action: FigmaBridgeDetailAction): Promise<void> {
    try {
      const detail = await this.figmaBridgeDetailService.loadDetail(action);
      this._panel.webview.postMessage({
        command: 'figmaBridgeDetail',
        data: detail
      });
    } catch (error) {
      logger.error('Error loading Figma bridge detail', error as Error);
      this._panel.webview.postMessage({
        command: 'figmaBridgeDetailFailed',
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

  private async handleRunTaskWorkflow(request?: TaskWorkflowRunRequest): Promise<void> {
    const runRequest = this.withTaskContext(request || {});
    const result = await this.workflowExecutionService.run(runRequest);

    if (result.outcome === 'already-running') {
      this._panel.webview.postMessage({
        command: 'taskWorkflowRunFailed',
        data: { message: result.message }
      });
      return;
    }

    if (result.outcome === 'completed') {
      this._panel.webview.postMessage({
        command: 'taskWorkflowRunComplete',
        data: result.data
      });
      vscode.window.showInformationMessage('NWA: Workflow completed.');
      return;
    }

    logger.error('Error running task workflow', result.error);
    this._panel.webview.postMessage({
      command: 'taskWorkflowRunFailed',
      data: {
        message: result.message,
        blockId: result.blockId,
        state: result.state,
        workflow: result.workflow
      }
    });
    vscode.window.showErrorMessage(`Workflow failed: ${result.message}`);
  }

  private postTaskWorkflowStatus(blockId: string, status: WorkflowStatus): void {
    this._panel.webview.postMessage({
      command: 'taskWorkflowStatusChanged',
      data: { blockId, status }
    });
  }

  private async handleMarkWorkflowStepDone(request?: TaskWorkflowStepDoneRequest): Promise<void> {
    if (!request) {
      return;
    }

    try {
      const result = await this.taskManagerService.markWorkflowStepDone(this.withTaskContext(request));
      this.applyStateContext(result.state);
      this._panel.webview.postMessage({
        command: 'taskWorkflowStepDoneComplete',
        data: result
      });
    } catch (error) {
      logger.error('Error marking workflow step done', error as Error);
      this._panel.webview.postMessage({
        command: 'taskWorkflowStepDoneFailed',
        data: { message: (error as Error).message }
      });
    }
  }

  /** The `code` step of the current workflow, whose model/speed drives the code run. */
  private findCodeStep(state: TaskManagerState): WorkflowStepBlock | undefined {
    const blocks = state.currentWorkflow?.blocks ?? [];
    for (const block of blocks) {
      if (block.kind === 'step' && block.stepType === 'code') {
        return block;
      }
      if (block.kind === 'parallel') {
        const child = block.children.find(c => c.stepType === 'code');
        if (child) {
          return child;
        }
      }
    }
    return undefined;
  }

  private withTaskContext<T extends { mode?: TaskManagerMode; itemId?: string; itemType?: TaskItemType }>(request: T): T {
    return {
      ...request,
      mode: request.mode || this.mode,
      itemId: request.itemId || this.currentItemId,
      itemType: request.itemType || this.currentItemType
    };
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
      const codeStep = this.findCodeStep(result.state);
      await this.claudeCodeTerminalService.open(
        workspaceFolder,
        markdownPath,
        result.state.currentItem?.id,
        event => this._panel.webview.postMessage({
          command: 'taskMarkdownRunStopped',
          data: event
        }),
        codeStep?.model,
        codeStep?.modelSpeed
      );

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
      vscode.window.showInformationMessage('NWA: Claude Code terminal opened.');
    } catch (error) {
      logger.error('Error running task markdown', error as Error);
      this._panel.webview.postMessage({
        command: 'taskMarkdownRunFailed',
        data: { message: (error as Error).message }
      });
    }
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

  private getTaskItemTypeLabel(type: TaskItemType): string {
    if (type === 'bug') {
      return 'bug';
    }

    return type === 'analysis' ? 'analysis' : 'task';
  }

  public dispose(): void {
    TaskManagerPanel.currentPanel = undefined;
    this.claudeCodeTerminalService.dispose();
    this.workflowExecutionService.dispose();
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
