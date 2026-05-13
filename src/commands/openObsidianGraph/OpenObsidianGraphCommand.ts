import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { ObsidianGraphPanel } from '../../features/obsidianGraph/webview/panel';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenObsidianGraphCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.GRAPH_OBSIDIAN, dependencies);
  }

  async execute(): Promise<void> {
    const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('NWA: Please open/select a repository folder first');
      return;
    }

    logger.info('Opening Graph Obsidian for repository', workspaceFolder.fsPath);
    ObsidianGraphPanel.createOrShow(this.dependencies.context.extensionUri, workspaceFolder.fsPath);
  }
}
