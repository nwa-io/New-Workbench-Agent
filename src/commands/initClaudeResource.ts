import * as vscode from 'vscode';
import { ClaudeResourcePanel } from '../webview/ClaudeResourcePanel';
import { FileSystemService } from '../services/FileSystemService';

export async function initClaudeResourceCommand(extensionUri: vscode.Uri): Promise<void> {
  const fileSystemService = new FileSystemService();
  const workspaceFolder = await fileSystemService.getWorkspaceFolder();

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('NWA: Please open a workspace folder first');
    return;
  }

  ClaudeResourcePanel.createOrShow(extensionUri);
}
