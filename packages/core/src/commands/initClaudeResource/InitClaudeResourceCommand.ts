import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { ClaudeResourcePanel } from '../../webview/ClaudeResourcePanel';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class InitClaudeResourceCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.INIT_CLAUDE_RESOURCE, dependencies);
  }

  async execute(): Promise<void> {
    const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('NWA: Please open a workspace folder first');
      return;
    }

    ClaudeResourcePanel.createOrShow(this.dependencies.context.extensionUri);
  }
}
