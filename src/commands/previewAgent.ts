import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { agentDescriptions } from '../webview/data/agentDescriptions';

export async function previewAgentCommand(departmentId: string, agentName: string): Promise<void> {
  logger.info('Previewing agent', { departmentId, agentName });

  try {
    const description = agentDescriptions[agentName] || 'Agent description not available';
    const templateContent = generateFallbackContent(agentName, departmentId, description);

    const doc = await vscode.workspace.openTextDocument({
      content: templateContent,
      language: 'markdown',
    });

    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside,
    });

    const action = await vscode.window.showInformationMessage(
      `Preview: ${formatAgentName(agentName)}`,
      'Install Agent',
      'Close'
    );

    if (action === 'Install Agent') {
      vscode.commands.executeCommand('agentkit.openPanel');
    }
  } catch (error) {
    logger.error('Failed to preview agent', error as Error);
    vscode.window.showErrorMessage(`Failed to preview agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateFallbackContent(agentName: string, departmentId: string, description: string): string {
  const formattedName = formatAgentName(agentName);
  const formattedDept = formatDepartmentName(departmentId);

  return `# ${formattedName}

**Department:** ${formattedDept}

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

function formatAgentName(agentName: string): string {
  return agentName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDepartmentName(deptId: string): string {
  return deptId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
