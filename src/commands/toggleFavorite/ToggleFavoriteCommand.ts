import * as vscode from 'vscode';
import { AgentTreeItem } from '../../providers/AgentTreeItem';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class ToggleFavoriteCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.TOGGLE_FAVORITE, dependencies);
  }

  async execute(treeItem?: unknown): Promise<void> {
    try {
      const agentTreeItem = treeItem as AgentTreeItem | undefined;
      const agentId = agentTreeItem?.agentId;
      const agentName = agentTreeItem?.label || agentId;

      if (!agentId) {
        logger.warn('No agent ID found on tree item');
        vscode.window.showWarningMessage('Could not identify agent to favorite');
        return;
      }

      const wasFavorite = this.dependencies.configService.isFavoriteAgent(agentId);
      await this.dependencies.configService.toggleFavoriteAgent(agentId);
      this.dependencies.availableProvider.refresh();

      const message = wasFavorite
        ? `Removed "${agentName}" from favorites`
        : `Added "${agentName}" to favorites`;

      vscode.window.showInformationMessage(message);
    } catch (error) {
      logger.error('Toggle favorite command failed', error as Error);
      vscode.window.showErrorMessage(`Failed to update favorites: ${(error as Error).message}`);
    }
  }
}
