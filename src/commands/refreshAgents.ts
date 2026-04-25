import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export function refreshAgentsCommand(): void {
  try {
    vscode.commands.executeCommand('workbench.view.extension.agentkit-sidebar');
    
    logger.info('Agents refreshed');
    vscode.window.setStatusBarMessage('$(sync~spin) AgentKit: Refreshing agents...', 1000);
    
    setTimeout(() => {
      vscode.window.setStatusBarMessage('$(check) AgentKit: Agents refreshed', 2000);
    }, 1000);
    
  } catch (error: any) {
    logger.error('Error refreshing agents', error);
    vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
  }
}