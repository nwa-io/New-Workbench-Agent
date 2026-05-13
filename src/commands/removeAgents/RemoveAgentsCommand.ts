import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class RemoveAgentsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.REMOVE_AGENTS, dependencies);
  }

  async execute(): Promise<void> {
    try {
      const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
      }

      const answer = await vscode.window.showWarningMessage(
        'This will remove ALL NWA configuration folders (.cursorrules, .claude, .aider, .github/copilot-instructions.md, .ai). This action cannot be undone. Continue?',
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
          title: 'NWA: Removing agents...',
          cancellable: false
        },
        async progress => {
          progress.report({ increment: 0, message: 'Removing configuration...' });

          try {
            const removedCount = await this.removeAgentConfiguration(workspaceFolder);
            progress.report({ increment: 100, message: 'Complete!' });

            vscode.window.showInformationMessage(`Removed ${removedCount} NWA configuration folders`);
            await vscode.commands.executeCommand(COMMANDS.REFRESH_AGENTS);
          } catch (error) {
            logger.error('Error removing agents', error as Error);
            vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
          }
        }
      );
    } catch (error) {
      logger.error('Error in remove agents command', error as Error);
      vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
    }
  }

  private async removeAgentConfiguration(workspaceFolder: vscode.Uri): Promise<number> {
    const agentFolders = ['.cursorrules', '.claude', '.aider', '.ai'];
    let removedCount = 0;

    for (const folder of agentFolders) {
      const folderPath = path.join(workspaceFolder.fsPath, folder);

      if (await this.dependencies.fileSystemService.folderExists(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
        removedCount++;
        logger.info(`Removed folder: ${folder}`);
      }
    }

    const copilotPath = path.join(workspaceFolder.fsPath, '.github', 'copilot-instructions.md');
    if (await this.dependencies.fileSystemService.fileExists(copilotPath)) {
      await fs.promises.unlink(copilotPath);
      logger.info('Removed copilot-instructions.md');
    }

    return removedCount;
  }
}
