import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { agentDescriptions } from '../webview/data/agentDescriptions';

// Store extension path when set
let extensionPath: string | undefined;

export function setExtensionPath(path: string): void {
  extensionPath = path;
}

export async function previewAgentCommand(departmentId: string, agentName: string): Promise<void> {
  logger.info('Previewing agent', { departmentId, agentName });

  try {
    // Try multiple ways to get extension path
    let extPath = extensionPath;

    if (!extPath) {
      const ext = vscode.extensions.getExtension('patricio0312rev.agentkit-vscode');
      extPath = ext?.extensionPath;
    }

    if (!extPath) {
      // Fallback: use __dirname to navigate to extension root
      extPath = path.resolve(__dirname, '..');
    }

    // Construct path to agent template - templates are in dist/templates/departments/
    const templatePath = path.join(extPath, 'dist', 'templates', 'departments', departmentId, `${agentName}.md`);

    let templateContent: string;
    try {
      templateContent = fs.readFileSync(templatePath, 'utf-8');
    } catch {
      // If template not found, create a preview with description
      const description = agentDescriptions[agentName] || 'Agent description not available';
      templateContent = generateFallbackContent(agentName, departmentId, description);
    }

    // Open in read-only preview mode
    const doc = await vscode.workspace.openTextDocument({
      content: templateContent,
      language: 'markdown',
    });

    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside,
    });

    // Show install action
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

Install this agent to your project using the AgentKit Manager.

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
