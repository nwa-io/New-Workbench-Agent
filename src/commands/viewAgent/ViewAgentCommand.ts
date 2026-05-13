import * as path from 'path';
import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class ViewAgentCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.VIEW_AGENT, dependencies);
  }

  async execute(agentPath?: unknown): Promise<void> {
    logger.info('Viewing agent', agentPath);

    if (typeof agentPath !== 'string' || agentPath.length === 0) {
      vscode.window.showWarningMessage('No agent file selected');
      return;
    }

    try {
      await this.dependencies.fileSystemService.openFile(agentPath);
    } catch (error) {
      logger.error('Error opening agent file', error as Error);
      vscode.window.showErrorMessage(`Failed to open agent: ${path.basename(agentPath)}`);
    }
  }
}
