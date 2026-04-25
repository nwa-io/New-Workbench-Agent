import * as vscode from 'vscode';
import * as path from 'path';
import { AgentTreeItem } from './AgentTreeItem';
import { FileSystemService } from '../services/FileSystemService';
import { logger } from '../utils/logger';


const FLAT_STRUCTURE_TOOLS: Record<string, string> = {
  '.claude': 'agents',
  '.github': 'copilot-instructions',
};

export class InstalledAgentsProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgentTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<AgentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private fileSystemService: FileSystemService;
  private installedAgents: Map<string, string[]> = new Map();

  constructor() {
    this.fileSystemService = new FileSystemService();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();
    
    if (!workspaceFolder) {
      return [];
    }

    if (!element) {
      // Root level - show departments
      await this.loadInstalledAgents(workspaceFolder.fsPath);
      return this.getDepartmentItems();
    } else if (element.type === 'department' && element.departmentId) {
      // Department level - show agents
      return this.getAgentItems(element.departmentId);
    }

    return [];
  }

  private async loadInstalledAgents(workspaceRoot: string): Promise<void> {
    try {
      const agentFiles = await this.fileSystemService.getInstalledAgents(workspaceRoot);
      this.installedAgents.clear();

      for (const agentFile of agentFiles) {
        const parts = agentFile.split(path.sep);
        if (parts.length < 2) {
          continue;
        }

        const toolFolder = parts[0];
        const department = this.extractDepartment(toolFolder, parts);

        if (department) {
          if (!this.installedAgents.has(department)) {
            this.installedAgents.set(department, []);
          }

          this.installedAgents.get(department)?.push(
            path.join(workspaceRoot, agentFile)
          );
        }
      }
    } catch (error) {
      logger.error('Error loading installed agents', error as Error);
    }
  }

  private extractDepartment(toolFolder: string, parts: string[]): string | null {
    const flatSubpath = FLAT_STRUCTURE_TOOLS[toolFolder];

    if (flatSubpath !== undefined) {
      // Flat structure: .claude/agents/agent.md -> tool name as department
      if (parts.length >= 2) {
        return this.getToolDisplayName(toolFolder);
      }
    } else {
      // Department structure: .cursorrules/engineering/agent.md
      if (parts.length >= 3) {
        return parts[1];
      }
    }

    return null;
  }

  private getToolDisplayName(toolFolder: string): string {
    const names: Record<string, string> = {
      '.claude': 'Claude Code',
      '.github': 'GitHub Copilot',
    };
    return names[toolFolder] || toolFolder;
  }

  private getDepartmentItems(): AgentTreeItem[] {
    const items: AgentTreeItem[] = [];

    for (const [deptId, agents] of this.installedAgents.entries()) {
      const item = new AgentTreeItem(
        `${this.formatDepartmentName(deptId)} (${agents.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'department',
        deptId
      );
      items.push(item);
    }

    return items.sort((a, b) => a.label.localeCompare(b.label));
  }

  private getAgentItems(departmentId: string): AgentTreeItem[] {
    const agents = this.installedAgents.get(departmentId) || [];
    
    return agents.map(agentPath => {
      const agentName = path.basename(agentPath, '.md');
      return new AgentTreeItem(
        agentName,
        vscode.TreeItemCollapsibleState.None,
        'agent',
        departmentId,
        agentPath
      );
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  private formatDepartmentName(deptId: string): string {
    return deptId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}