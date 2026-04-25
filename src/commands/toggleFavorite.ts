import * as vscode from 'vscode';
import { AgentTreeItem } from '../providers/AgentTreeItem';
import { ConfigService } from '../services/ConfigService';
import { AvailableAgentsProvider } from '../providers/AvailableAgentsProvider';
import { logger } from '../utils/logger';

export async function toggleFavoriteCommand(
  treeItem: AgentTreeItem | undefined,
  configService: ConfigService,
  availableProvider: AvailableAgentsProvider
): Promise<void> {
  try {
    const agentId = treeItem?.agentId;
    const agentName = treeItem?.label || agentId;

    if (!agentId) {
      logger.warn('No agent ID found on tree item');
      vscode.window.showWarningMessage('Could not identify agent to favorite');
      return;
    }

    const wasFavorite = configService.isFavoriteAgent(agentId);
    await configService.toggleFavoriteAgent(agentId);

    // Refresh the tree view to update icons
    availableProvider.refresh();

    const message = wasFavorite
      ? `Removed "${agentName}" from favorites`
      : `Added "${agentName}" to favorites`;

    vscode.window.showInformationMessage(message);
  } catch (error) {
    logger.error('Toggle favorite command failed', error as Error);
    vscode.window.showErrorMessage(`Failed to update favorites: ${error instanceof Error ? error.message : String(error)}`);
  }
}
