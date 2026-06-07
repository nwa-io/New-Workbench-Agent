import * as vscode from 'vscode';
import { BaseCommand } from './BaseCommand';
import { CommandDependencies } from './types';
import { COMMANDS } from '../utils/constants';

export class AddManualMemoryCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.MEMORY_ADD, dependencies);
  }

  async execute(): Promise<void> {
    const { memoryService, memoryProvider } = this.dependencies;
    if (!memoryService) {
      vscode.window.showWarningMessage('NWA: Memory service is not available (no workspace open).');
      return;
    }

    const title = await vscode.window.showInputBox({
      prompt: 'Memory title',
      placeHolder: 'e.g. Workflow files use YAML format'
    });
    if (!title?.trim()) { return; }

    const summary = await vscode.window.showInputBox({
      prompt: 'Memory summary',
      placeHolder: 'Describe what should be remembered and why it matters'
    });
    if (!summary?.trim()) { return; }

    const tagsRaw = await vscode.window.showInputBox({
      prompt: 'Tags (comma-separated)',
      placeHolder: 'e.g. architecture, yaml, workflow'
    });

    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    await memoryService.addManualMemory(title.trim(), summary.trim(), tags);
    await memoryProvider?.refresh();
    vscode.window.showInformationMessage('NWA: Memory saved.');
  }
}

export class SearchMemoryCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.MEMORY_SEARCH, dependencies);
  }

  async execute(): Promise<void> {
    const { memoryService } = this.dependencies;
    if (!memoryService) {
      vscode.window.showWarningMessage('NWA: Memory service is not available (no workspace open).');
      return;
    }

    const query = await vscode.window.showInputBox({
      prompt: 'Search memories',
      placeHolder: 'Enter keywords, file paths, or Jira keys'
    });
    if (!query?.trim()) { return; }

    const keywords = query.trim().split(/\s+/);
    const results = await memoryService.searchMemories({ keywords, limit: 20 });

    if (!results.length) {
      vscode.window.showInformationMessage('NWA: No relevant memories found.');
      return;
    }

    const items = results.map(m => ({
      label: m.title,
      description: m.type,
      detail: m.summary,
      memory: m
    }));

    await vscode.window.showQuickPick(items, {
      matchOnDescription: true,
      matchOnDetail: true,
      title: `Memory Search — ${results.length} result(s)`
    });
  }
}

export class ShowMemoryCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.MEMORY_SHOW, dependencies);
  }

  async execute(): Promise<void> {
    const { memoryService } = this.dependencies;
    if (!memoryService) {
      vscode.window.showWarningMessage('NWA: Memory service is not available (no workspace open).');
      return;
    }

    const all = await memoryService.loadAllMemories();
    if (!all.length) {
      vscode.window.showInformationMessage('NWA: No memories stored yet.');
      return;
    }

    const items = all
      .slice(-50)
      .reverse()
      .map(m => ({
        label: m.title,
        description: m.type,
        detail: `${m.summary}${m.tags.length ? ` [${m.tags.join(', ')}]` : ''}`,
        memory: m
      }));

    await vscode.window.showQuickPick(items, {
      matchOnDescription: true,
      matchOnDetail: true,
      title: `All Memories — ${all.length} total`
    });
  }
}

export class ClearMemoryCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.MEMORY_CLEAR, dependencies);
  }

  async execute(): Promise<void> {
    const { memoryService, memoryProvider } = this.dependencies;
    if (!memoryService) {
      vscode.window.showWarningMessage('NWA: Memory service is not available (no workspace open).');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      'NWA: Clear all memories? This cannot be undone.',
      { modal: true },
      'Clear All'
    );

    if (confirm !== 'Clear All') { return; }

    await memoryService.clearAllMemories();
    await memoryProvider?.refresh();
    vscode.window.showInformationMessage('NWA: All memories cleared.');
  }
}

export class RefreshMemoryTreeCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.MEMORY_REFRESH_TREE, dependencies);
  }

  async execute(): Promise<void> {
    await this.dependencies.memoryProvider?.refresh();
  }
}
