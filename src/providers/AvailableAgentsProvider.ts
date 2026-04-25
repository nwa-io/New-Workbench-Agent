import * as vscode from 'vscode';
import { AgentTreeItem } from './AgentTreeItem';
import { AgentKitService } from '../services/AgentKitService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';
import { agentDescriptions } from '../webview/data/agentDescriptions';

export class AvailableAgentsProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgentTreeItem | undefined | null | void> =
    new vscode.EventEmitter<AgentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private agentKitService: AgentKitService;
  private configService: ConfigService;
  private departments: any = {};
  private _filterText: string = '';

  constructor(configService?: ConfigService) {
    this.agentKitService = new AgentKitService();
    this.configService = configService || new ConfigService();
    this.loadDepartments();
  }

  refresh(): void {
    this.loadDepartments();
    this._onDidChangeTreeData.fire();
  }

  setFilter(filterText: string): void {
    this._filterText = filterText.toLowerCase();
    logger.info('Setting agent filter', { filterText: this._filterText });
    this.refresh();
  }

  clearFilter(): void {
    this._filterText = '';
    logger.info('Clearing agent filter');
    this.refresh();
  }

  private async loadDepartments(): Promise<void> {
    try {
      this.departments = await this.agentKitService.getDepartments();
    } catch (error) {
      logger.error('Error loading departments', error as Error);
    }
  }

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
    if (!element) {
      // Root level - show favorites section (if any) then departments
      const items: AgentTreeItem[] = [];

      // Add favorites section if there are favorites and no filter active
      if (!this._filterText) {
        const favorites = this.configService.getFavoriteAgents();
        if (favorites.length > 0) {
          const favoritesItem = new AgentTreeItem(
            `Favorites (${favorites.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'favorites-section',
            undefined,
            undefined
          );
          items.push(favoritesItem);
        }
      }

      // Add departments
      const departmentItems = this.getDepartmentItems();
      items.push(...departmentItems);

      return items;
    } else if (element.type === 'favorites-section') {
      // Favorites section - show favorite agents
      return this.getFavoriteAgentItems();
    } else if (element.type === 'department' && element.departmentId) {
      // Department level - show agents
      return this.getAgentItems(element.departmentId);
    }

    return [];
  }

  private getDepartmentItems(): AgentTreeItem[] {
    const items: AgentTreeItem[] = [];

    for (const [deptId, dept] of Object.entries(this.departments)) {
      const deptData = dept as any;

      // Apply filter if set
      if (this._filterText) {
        const deptMatch = deptData.name.toLowerCase().includes(this._filterText);
        const agentMatch = deptData.agents.some((agent: string) =>
          agent.toLowerCase().includes(this._filterText)
        );
        if (!deptMatch && !agentMatch) {
          continue;
        }
      }

      const item = new AgentTreeItem(
        `${deptData.name} (${deptData.agents.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'department',
        deptId
      );
      items.push(item);
    }

    return items;
  }

  private getFavoriteAgentItems(): AgentTreeItem[] {
    const favoriteIds = this.configService.getFavoriteAgents();
    const items: AgentTreeItem[] = [];

    for (const agentId of favoriteIds) {
      // Find the agent in departments
      let foundDept: string | null = null;
      let foundDeptName: string | null = null;

      for (const [deptId, dept] of Object.entries(this.departments)) {
        const deptData = dept as any;
        if (deptData.agents.includes(agentId)) {
          foundDept = deptId;
          foundDeptName = deptData.name;
          break;
        }
      }

      if (foundDept) {
        const item = new AgentTreeItem(
          agentId,
          vscode.TreeItemCollapsibleState.None,
          'favorite-agent',
          foundDept,
          `${foundDept}/${agentId}`
        );

        item.agentId = agentId;
        item.description = foundDeptName || foundDept;
        item.tooltip = new vscode.MarkdownString(
          `**${agentId}**\n\n${agentDescriptions[agentId] || ''}\n\nDepartment: ${foundDeptName}\n\n*Click to preview or install this agent*`
        );

        item.command = {
          command: 'agentkit.previewAgent',
          title: 'Preview Agent',
          arguments: [foundDept, agentId]
        };

        items.push(item);
      }
    }

    return items;
  }

  private getAgentItems(departmentId: string): AgentTreeItem[] {
    const dept = this.departments[departmentId];
    if (!dept) {
      return [];
    }

    let agents = dept.agents as string[];

    // Apply filter if set
    if (this._filterText) {
      agents = agents.filter(agent =>
        agent.toLowerCase().includes(this._filterText)
      );
    }

    return agents.map((agentName: string) => {
      const isFavorite = this.configService.isFavoriteAgent(agentName);
      const item = new AgentTreeItem(
        agentName,
        vscode.TreeItemCollapsibleState.None,
        'agent',
        departmentId,
        `${departmentId}/${agentName}`
      );

      item.agentId = agentName;

      // Show star icon for favorites
      if (isFavorite) {
        item.iconPath = new vscode.ThemeIcon('star-full');
      }

      item.command = {
        command: 'agentkit.previewAgent',
        title: 'Preview Agent',
        arguments: [departmentId, agentName]
      };

      item.tooltip = new vscode.MarkdownString(
        `**${agentName}**${isFavorite ? ' ⭐' : ''}\n\n${agentDescriptions[agentName] || ''}\n\nDepartment: ${dept.name}\n\n*Click to preview or install this agent*`
      );

      // Add context value for right-click menu
      item.contextValue = isFavorite ? 'agent-favorite' : 'agent';

      return item;
    });
  }
}
