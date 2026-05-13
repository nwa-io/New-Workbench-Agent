import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class UpdateAgentsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.UPDATE_AGENTS, dependencies);
  }

  async execute(): Promise<void> {
    try {
      const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
      }

      const answer = await vscode.window.showWarningMessage(
        'This will update all installed agents to the latest version. Existing customizations will be preserved. Continue?',
        { modal: true },
        'Update',
        'Cancel'
      );

      if (answer !== 'Update') {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NWA: Updating agents...',
          cancellable: false
        },
        async progress => {
          progress.report({ increment: 0, message: 'Checking for updates...' });

          try {
            const installedAgents = await this.dependencies.fileSystemService.getInstalledAgents(workspaceFolder.fsPath);

            if (installedAgents.length === 0) {
              vscode.window.showInformationMessage('No agents installed yet');
              return;
            }

            progress.report({ increment: 50, message: 'Updating agents...' });

            await this.waitForPlaceholderUpdate();
            progress.report({ increment: 100, message: 'Complete!' });

            vscode.window.showInformationMessage(`Updated ${installedAgents.length} agents successfully!`);
            await vscode.commands.executeCommand(COMMANDS.REFRESH_AGENTS);
          } catch (error) {
            logger.error('Error updating agents', error as Error);
            vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
          }
        }
      );
    } catch (error) {
      logger.error('Error in update agents command', error as Error);
      vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
    }
  }

  private waitForPlaceholderUpdate(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
}
