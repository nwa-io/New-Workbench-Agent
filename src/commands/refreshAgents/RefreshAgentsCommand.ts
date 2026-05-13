import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class RefreshAgentsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.REFRESH_AGENTS, dependencies);
  }

  execute(): void {
    try {
      logger.info('Refreshing agents');
      this.dependencies.installedProvider.refresh();
      this.dependencies.availableProvider.refresh();

      vscode.commands.executeCommand('workbench.view.extension.agentkit-sidebar');
      vscode.window.setStatusBarMessage('$(sync~spin) AgentKit: Refreshing agents...', 1000);

      setTimeout(() => {
        vscode.window.setStatusBarMessage('$(check) AgentKit: Agents refreshed', 2000);
      }, 1000);
    } catch (error) {
      logger.error('Error refreshing agents', error as Error);
      vscode.window.showErrorMessage(`AgentKit Error: ${(error as Error).message}`);
    }
  }
}
