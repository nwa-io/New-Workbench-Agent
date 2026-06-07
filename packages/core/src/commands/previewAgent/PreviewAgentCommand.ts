import * as vscode from 'vscode';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { agentDescriptions } from '../../webview/data/agentDescriptions';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class PreviewAgentCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.PREVIEW_AGENT, dependencies);
  }

  async execute(departmentId?: unknown, agentName?: unknown): Promise<void> {
    if (typeof departmentId !== 'string' || typeof agentName !== 'string') {
      vscode.window.showWarningMessage('No agent selected for preview');
      return;
    }

    logger.info('Previewing agent', { departmentId, agentName });

    try {
      const description = agentDescriptions[agentName] || 'Agent description not available';
      const templateContent = this.generateFallbackContent(agentName, departmentId, description);

      const document = await vscode.workspace.openTextDocument({
        content: templateContent,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(document, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside
      });

      const action = await vscode.window.showInformationMessage(
        `Preview: ${this.formatName(agentName)}`,
        'Install Agent',
        'Close'
      );

      if (action === 'Install Agent') {
        await vscode.commands.executeCommand(COMMANDS.OPEN_PANEL);
      }
    } catch (error) {
      logger.error('Failed to preview agent', error as Error);
      vscode.window.showErrorMessage(`Failed to preview agent: ${(error as Error).message}`);
    }
  }

  private generateFallbackContent(agentName: string, departmentId: string, description: string): string {
    const formattedName = this.formatName(agentName);
    const formattedDepartment = this.formatName(departmentId);

    return `# ${formattedName}

**Department:** ${formattedDepartment}

## Overview

${description}

## Capabilities

This agent specializes in ${description.toLowerCase()}

## Usage

Install this agent to your project using the NWA Manager.

---

*Click "Install Agent" to add this agent to your project.*
`;
  }

  private formatName(value: string): string {
    return value
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
