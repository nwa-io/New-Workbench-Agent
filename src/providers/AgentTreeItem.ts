import * as vscode from 'vscode';
import * as path from 'path';

export type AgentTreeItemType = 'department' | 'agent' | 'favorites-section' | 'favorite-agent';

export class AgentTreeItem extends vscode.TreeItem {
  public agentId?: string;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: AgentTreeItemType,
    public readonly departmentId?: string,
    public readonly agentPath?: string
  ) {
    super(label, collapsibleState);

    if (type === 'department') {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'department';
    } else if (type === 'favorites-section') {
      this.iconPath = new vscode.ThemeIcon('star-full');
      this.contextValue = 'favorites-section';
      this.tooltip = 'Your favorite agents';
    } else if (type === 'favorite-agent') {
      this.iconPath = new vscode.ThemeIcon('star-full');
      this.contextValue = 'favorite-agent';
    } else {
      this.iconPath = new vscode.ThemeIcon('file-code');
      this.contextValue = 'agent';

      // Pass only the agentPath, not the entire object
      if (agentPath) {
        this.command = {
          command: 'agentkit.viewAgent',
          title: 'View Agent',
          arguments: [agentPath] // Only pass the path string
        };

        this.description = path.basename(path.dirname(agentPath));
        this.tooltip = new vscode.MarkdownString(
          `**${label}**\n\n${agentPath}\n\n*Click to view agent file*`
        );
      }
    }
  }
}
