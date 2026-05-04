import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { FileSystemService } from '../services/FileSystemService';
import { TaskManagerService } from '../services/TaskManagerService';
import { logger } from '../utils/logger';
import { TaskDocumentUpload, TaskManagerMode } from '../models/TaskManager';
import { getTaskManagerContent } from './taskManagerContent';

export class TaskManagerPanel {
  public static currentPanel: TaskManagerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private taskManagerService: TaskManagerService;
  private mode: TaskManagerMode;

  public static createOrShow(
    extensionUri: vscode.Uri,
    configService?: ConfigService,
    mode: TaskManagerMode = 'task'
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

    TaskManagerPanel.currentPanel = new TaskManagerPanel(panel, configService, mode);
  }

  private constructor(panel: vscode.WebviewPanel, configService?: ConfigService, mode: TaskManagerMode = 'task') {
    this._panel = panel;
    this.mode = mode;
    this.taskManagerService = new TaskManagerService(configService, new FileSystemService());

    this._panel.webview.html = getTaskManagerContent(this.mode);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'getTaskManagerState':
            await this.handleGetTaskManagerState(message.data?.mode);
            break;
          case 'setTaskMode':
            await this.handleSetTaskMode(message.data?.mode);
            break;
          case 'uploadTaskDocument':
            await this.handleUploadTaskDocument(message.data);
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

  private async handleGetTaskManagerState(mode?: TaskManagerMode): Promise<void> {
    if (mode === 'task' || mode === 'fix-bug') {
      this.mode = mode;
    }

    await this.postTaskManagerState();
  }

  private async postTaskManagerState(): Promise<void> {
    try {
      const state = await this.taskManagerService.getState(this.mode);
      this._panel.webview.postMessage({
        command: 'taskManagerState',
        data: state
      });
    } catch (error) {
      logger.error('Error loading task manager state', error as Error);
      vscode.window.showErrorMessage(`Task Manager Error: ${(error as Error).message}`);
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
            mode: upload.mode || this.mode
          });
          progress.report({ increment: 100 });
          return importResult;
        }
      );

      this.mode = result.state.mode;
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
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
