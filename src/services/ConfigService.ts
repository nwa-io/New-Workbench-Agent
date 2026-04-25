import * as vscode from 'vscode';
import { CONFIG_KEYS } from '../utils/constants';
import { ToolType } from '../models/AgentConfig';
import { logger } from '../utils/logger';

export class ConfigService {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration();
  }

  refresh(): void {
    this.config = vscode.workspace.getConfiguration();
  }

  getDefaultTool(): ToolType {
    return this.config.get<ToolType>(CONFIG_KEYS.DEFAULT_TOOL, 'cursor');
  }

  getDefaultFolder(): string {
    return this.config.get<string>(CONFIG_KEYS.DEFAULT_FOLDER, '');
  }

  getAutoRefresh(): boolean {
    return this.config.get<boolean>(CONFIG_KEYS.AUTO_REFRESH, true);
  }

  getShowWelcome(): boolean {
    return this.config.get<boolean>(CONFIG_KEYS.SHOW_WELCOME, true);
  }

  getDefaultDepartments(): string[] {
    return this.config.get<string[]>(CONFIG_KEYS.DEFAULT_DEPARTMENTS, ['engineering', 'design']);
  }

  async setDefaultTool(tool: ToolType): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.DEFAULT_TOOL,
      tool,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
  }

  async setShowWelcome(show: boolean): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.SHOW_WELCOME,
      show,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
  }

  // Favorites management
  getFavoriteAgents(): string[] {
    const favorites = this.config.get<string[]>(CONFIG_KEYS.FAVORITE_AGENTS, []);
    logger.debug('Getting favorite agents', { count: favorites.length });
    return favorites;
  }

  isFavoriteAgent(agentId: string): boolean {
    return this.getFavoriteAgents().includes(agentId);
  }

  async addFavoriteAgent(agentId: string): Promise<void> {
    const favorites = this.getFavoriteAgents();
    if (!favorites.includes(agentId)) {
      favorites.push(agentId);
      logger.info('Adding agent to favorites', { agentId });
      await this.config.update(
        CONFIG_KEYS.FAVORITE_AGENTS,
        favorites,
        vscode.ConfigurationTarget.Global
      );
      this.refresh();
    }
  }

  async removeFavoriteAgent(agentId: string): Promise<void> {
    const favorites = this.getFavoriteAgents();
    const index = favorites.indexOf(agentId);
    if (index > -1) {
      favorites.splice(index, 1);
      logger.info('Removing agent from favorites', { agentId });
      await this.config.update(
        CONFIG_KEYS.FAVORITE_AGENTS,
        favorites,
        vscode.ConfigurationTarget.Global
      );
      this.refresh();
    }
  }

  async toggleFavoriteAgent(agentId: string): Promise<void> {
    if (this.isFavoriteAgent(agentId)) {
      await this.removeFavoriteAgent(agentId);
    } else {
      await this.addFavoriteAgent(agentId);
    }
  }
}