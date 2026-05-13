import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenSettingsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.OPEN_SETTINGS, dependencies);
  }

  execute(): void {
    logger.info('Opening settings');
    vscode.commands.executeCommand('workbench.action.openSettings');
  }
}
