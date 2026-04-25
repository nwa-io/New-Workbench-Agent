import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileSystemService } from '../services/FileSystemService';
import { logger } from '../utils/logger';

export async function removeAgentsCommand(): Promise<void> {
  const fileSystemService = new FileSystemService();

  try {
    const workspaceFolder = await fileSystemService.getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('AgentKit: Please open a workspace folder first');
      return;
    }

    const answer = await vscode.window.showWarningMessage(
      'This will remove ALL AgentKit configuration folders (.cursorrules, .claude, .aider, .github/copilot-instructions.md, .ai). This action cannot be undone. Continue?',
      { modal: true },
      'Remove All',
      'Cancel'
    );

    if (answer !== 'Remove All') {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AgentKit: Removing agents...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Removing configuration...' });

        try {
          const agentFolders = ['.cursorrules', '.claude', '.aider', '.ai'];
          let removedCount = 0;

          for (const folder of agentFolders) {
            const folderPath = path.join(workspaceFolder.fsPath, folder);
            
            if (await fileSystemService.folderExists(folderPath)) {
              await fs.promises.rm(folderPath, { recursive: true, force: true });
              removedCount++;
              logger.info(`Removed folder: ${folder}`);
            }
          }

          // Remove GitHub Copilot instructions if exists
          const copilotPath = path.join(
            workspaceFolder.fsPath,
            '.github',
            'copilot-instructions.md'
          );
          if (await fileSystemService.fileExists(copilotPath)) {
            await fs.promises.unlink(copilotPath);
            logger.info('Removed copilot-instructions.md');
          }

          progress.report({ increment: 100, message: 'Complete!' });

          vscode.window.showInformationMessage(
            `✅ Removed ${removedCount} AgentKit configuration folders`
          );

          // Refresh tree views
          vscode.commands.executeCommand('agentkit.refreshAgents');

        } catch (error: any) {
          logger.error('Error removing agents', error);
          vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
        }
      }
    );

  } catch (error: any) {
    logger.error('Error in removeAgents command', error);
    vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
  }
}