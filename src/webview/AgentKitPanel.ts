import * as vscode from 'vscode';
import { AgentKitService } from '../services/AgentKitService';
import { FileSystemService } from '../services/FileSystemService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';
import { getWebviewContent } from './webviewContent';

export class AgentKitPanel {
  public static currentPanel: AgentKitPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private agentKitService: AgentKitService;
  private fileSystemService: FileSystemService;
  private configService: ConfigService;

  public static createOrShow(extensionUri: vscode.Uri, configService?: ConfigService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (AgentKitPanel.currentPanel) {
      AgentKitPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'agentkitPanel',
      'AgentKit Manager',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    AgentKitPanel.currentPanel = new AgentKitPanel(panel, extensionUri, configService);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, configService?: ConfigService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.agentKitService = new AgentKitService();
    this.fileSystemService = new FileSystemService();
    this.configService = configService || new ConfigService();

    this._panel.webview.html = getWebviewContent();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'install':
            await this.handleInstall(message.data);
            break;
          case 'getDepartments':
            await this.handleGetDepartments();
            break;
          case 'getFavorites':
            await this.handleGetFavorites();
            break;
          case 'toggleFavorite':
            await this.handleToggleFavorite(message.data);
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

  private async handleGetDepartments() {
    try {
      const departments = await this.agentKitService.getDepartments();
      this._panel.webview.postMessage({
        command: 'departmentsData',
        data: departments
      });
    } catch (error: any) {
      logger.error('Error getting departments', error);
    }
  }

  private async handleGetFavorites() {
    try {
      const favorites = this.configService.getFavoriteAgents();
      this._panel.webview.postMessage({
        command: 'favoritesData',
        data: favorites
      });
    } catch (error: any) {
      logger.error('Error getting favorites', error);
    }
  }

  private async handleToggleFavorite(data: { agentId: string }) {
    try {
      await this.configService.toggleFavoriteAgent(data.agentId);
      // Refresh favorites in webview
      await this.handleGetFavorites();
      // Refresh the available agents tree view
      vscode.commands.executeCommand('agentkit.refreshAgents');
    } catch (error: any) {
      logger.error('Error toggling favorite', error);
    }
  }

  private async handleInstall(data: any) {
    const { tool, folder, departments, agents, model } = data;

    try {
      const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('No workspace folder open');
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Installing AgentKit agents: ',
          cancellable: false
        },
        async (progress) => {
          progress.report({ increment: 0, message: 'Preparing...' });

          const config = {
            tool,
            folder,
            departments,
            agents,
            stack: [],
            model
          };

          progress.report({ increment: 30, message: 'Generating agents...' });

          await this.agentKitService.generateAgents(config, workspaceFolder.fsPath);

          progress.report({ increment: 100 });
        }
      );

      // Show toast notification that auto-dismisses after 3 seconds
      const action = await Promise.race([
        vscode.window.showInformationMessage(
          `Installed ${agents.length} agents successfully!`,
          'Open Folder'
        ),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 3000))
      ]);

      if (action === 'Open Folder') {
        await this.fileSystemService.revealInExplorer(
          vscode.Uri.joinPath(workspaceFolder, folder).fsPath
        );
      }

      this._panel.webview.postMessage({ command: 'installComplete' });
      vscode.commands.executeCommand('agentkit.refreshAgents');

    } catch (error: any) {
      logger.error('Error installing agents', error);
      vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
    }
  }

  public dispose() {
    AgentKitPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
