import * as vscode from 'vscode';
import { ClaudeResourcePanel } from '../webview/ClaudeResourcePanel';

export function initClaudeResourceCommand(extensionUri: vscode.Uri): void {
  ClaudeResourcePanel.createOrShow(extensionUri);
}
