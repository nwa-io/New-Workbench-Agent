import * as vscode from 'vscode';

export class WorkspaceFolderResolver {
  async resolve(): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (workspaceFolder) {
      return workspaceFolder;
    }

    const selectedFolders = await vscode.window.showOpenDialog({
      title: 'Select a workspace folder for NWA Init env',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open Folder'
    });

    if (!selectedFolders?.[0]) {
      vscode.window.showErrorMessage('NWA: Please open or select a workspace folder before running Init env');
      return undefined;
    }

    const addedWorkspaceFolder = vscode.workspace.updateWorkspaceFolders(
      vscode.workspace.workspaceFolders?.length ?? 0,
      0,
      { uri: selectedFolders[0] }
    );

    if (!addedWorkspaceFolder) {
      vscode.window.showInformationMessage('NWA: Using the selected folder for this Init env run');
    }

    return selectedFolders[0];
  }
}
