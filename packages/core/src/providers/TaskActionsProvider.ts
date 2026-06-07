import * as vscode from 'vscode';
import { COMMANDS } from '../utils/constants';

class TaskActionTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string, command: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command,
      title: label
    };
    this.tooltip = `${label}: ${description}`;
    this.contextValue = 'task-action';
  }
}

export class TaskActionsProvider implements vscode.TreeDataProvider<TaskActionTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskActionTreeItem | undefined | null | void> =
    new vscode.EventEmitter<TaskActionTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskActionTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskActionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): TaskActionTreeItem[] {
    return [
      new TaskActionTreeItem('Task', 'New task context', COMMANDS.OPEN_TASK_MANAGER, 'checklist'),
      new TaskActionTreeItem('Settings', 'Core settings', COMMANDS.OPEN_WORKFLOW_SETTINGS, 'gear'),
      new TaskActionTreeItem('Workflows', 'Build & edit workflows', COMMANDS.OPEN_WORKFLOWS, 'circuit-board')
    ];
  }
}
