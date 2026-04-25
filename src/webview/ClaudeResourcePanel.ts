import * as vscode from 'vscode';
import { getClaudeResourceContent } from './claudeResourceContent';

export class ClaudeResourcePanel {
  public static currentPanel: ClaudeResourcePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri): void {
    void extensionUri;

    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ClaudeResourcePanel.currentPanel) {
      ClaudeResourcePanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'claudeResourcePanel',
      'Init Resource Claude',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ClaudeResourcePanel.currentPanel = new ClaudeResourcePanel(panel);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = getClaudeResourceContent();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public dispose(): void {
    ClaudeResourcePanel.currentPanel = undefined;
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }
}
