import * as vscode from 'vscode';
import { CONFIG_KEYS, DEFAULT_COMPONENT_PATHS } from '../utils/constants';
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

  getTaskDocumentsFolder(): string {
    return this.config.get<string>(CONFIG_KEYS.TASK_DOCUMENTS_FOLDER, '.project/docs');
  }

  async setTaskDocumentsFolder(folder: string | undefined): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.TASK_DOCUMENTS_FOLDER,
      folder,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
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

  // ---------- Component scan paths ----------

  getComponentPaths(): string[] {
    const configured = this.config.get<string[]>(CONFIG_KEYS.COMPONENT_PATHS);
    if (Array.isArray(configured) && configured.length > 0) {
      return configured;
    }
    return [...DEFAULT_COMPONENT_PATHS];
  }

  async setComponentPaths(paths: string[]): Promise<void> {
    const cleaned = Array.from(new Set(paths.map(p => p.trim()).filter(Boolean)));
    await this.config.update(
      CONFIG_KEYS.COMPONENT_PATHS,
      cleaned,
      vscode.ConfigurationTarget.Workspace
    );
    this.refresh();
  }

  async addComponentPath(newPath: string): Promise<void> {
    const trimmed = newPath.trim();
    if (!trimmed) {
      return;
    }
    const paths = this.getComponentPaths();
    if (paths.includes(trimmed)) {
      return;
    }
    paths.push(trimmed);
    logger.info('Adding component scan path', { path: trimmed });
    await this.setComponentPaths(paths);
  }

  async removeComponentPath(removePath: string): Promise<void> {
    const paths = this.getComponentPaths().filter(p => p !== removePath);
    logger.info('Removing component scan path', { path: removePath });
    await this.setComponentPaths(paths);
  }
}
