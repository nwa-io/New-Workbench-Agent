import * as vscode from 'vscode';
import { MemoryRecord } from '../features/memory/MemoryTypes';
import { MemoryService } from '../features/memory/MemoryService';

class MemoryTreeItem extends vscode.TreeItem {
  constructor(public readonly memory: MemoryRecord) {
    super(memory.title, vscode.TreeItemCollapsibleState.None);
    this.description = memory.type;
    this.tooltip = memory.summary;
    this.iconPath = new vscode.ThemeIcon(
      memory.type === 'decision' ? 'lightbulb' : 'bookmark'
    );
    this.contextValue = 'memory-item';
  }
}

export class MemoryTreeProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
  private _onDidChangeTreeData =
    new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: MemoryTreeItem[] = [];

  constructor(private readonly memoryService: MemoryService) {}

  async refresh(): Promise<void> {
    const all = await this.memoryService.loadAllMemories();
    // Show last 50, newest first
    this.items = all
      .slice(-50)
      .reverse()
      .map(m => new MemoryTreeItem(m));
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): MemoryTreeItem[] {
    return this.items;
  }
}
