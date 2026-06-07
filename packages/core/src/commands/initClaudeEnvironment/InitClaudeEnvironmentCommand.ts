import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';
import { EnvironmentSetupService } from './EnvironmentSetupService';
import { WorkspaceFolderResolver } from './WorkspaceFolderResolver';

export class InitClaudeEnvironmentCommand extends BaseCommand {
  constructor(
    dependencies: CommandDependencies,
    private readonly workspaceFolderResolver = new WorkspaceFolderResolver(),
    private readonly environmentSetupService = new EnvironmentSetupService()
  ) {
    super(COMMANDS.INIT_CLAUDE_ENVIRONMENT, dependencies);
  }

  async execute(): Promise<void> {
    try {
      const workspaceFolder = await this.workspaceFolderResolver.resolve();
      if (!workspaceFolder) {
        return;
      }

      await this.ensureProjectDocsFolder(workspaceFolder);
      await this.environmentSetupService.run();

      vscode.window.showInformationMessage('NWA: Init env complete. Claude Code CLI, Codex CLI, and markitdown are ready.');
    } catch (error) {
      logger.error('Error initializing Claude environment', error as Error);
      vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
    }
  }

  private async ensureProjectDocsFolder(workspaceFolder: vscode.Uri): Promise<void> {
    const docsFolder = vscode.Uri.joinPath(workspaceFolder, '.project', 'docs');
    await vscode.workspace.fs.createDirectory(docsFolder);
  }
}
