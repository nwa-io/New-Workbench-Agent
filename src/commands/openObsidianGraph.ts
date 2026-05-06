import * as vscode from 'vscode';
import { ObsidianGraphPanel } from '../features/obsidianGraph/webview/panel';
import { FileSystemService } from '../services/FileSystemService';
import { logger } from '../utils/logger';

export async function openObsidianGraphCommand(extensionUri: vscode.Uri): Promise<void> {
  const fileSystemService = new FileSystemService();
  const workspaceFolder = await fileSystemService.getWorkspaceFolder();

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('NWA: Please open/select a repository folder first');
    return;
  }

  logger.info('Opening Graph Obsidian for repository', workspaceFolder.fsPath);
  ObsidianGraphPanel.createOrShow(extensionUri, workspaceFolder.fsPath);
}
