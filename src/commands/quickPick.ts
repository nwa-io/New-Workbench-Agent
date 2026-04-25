import * as vscode from 'vscode';
import { AgentConfig, TOOLS, ToolType } from '../models/AgentConfig';
import { AgentKitService } from '../services/AgentKitService';
import { FileSystemService } from '../services/FileSystemService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';

export async function quickInitCommand(context: vscode.ExtensionContext): Promise<void> {
  const fileSystemService = new FileSystemService();
  const agentKitService = new AgentKitService();
  const configService = new ConfigService();

  try {
    const workspaceFolder = await fileSystemService.getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('AgentKit: Please open a workspace folder first');
      return;
    }

    // Quick presets
    const presets = [
      {
        label: '🚀 Full Stack Developer',
        description: 'Engineering + Design + Testing',
        detail: 'Best for solo developers building complete apps',
        departments: ['engineering', 'design', 'testing']
      },
      {
        label: '⚡ Rapid Prototyper',
        description: 'Engineering + Product',
        detail: 'Fast MVP development with product guidance',
        departments: ['engineering', 'product']
      },
      {
        label: '🎨 Design-First',
        description: 'Design + UX + Marketing',
        detail: 'User-centric design and marketing',
        departments: ['design', 'marketing']
      },
      {
        label: '📈 Growth-Focused',
        description: 'Marketing + Product + Analytics',
        detail: 'User acquisition and growth',
        departments: ['marketing', 'product', 'studio-operations']
      },
      {
        label: '🏢 Enterprise Team',
        description: 'All departments',
        detail: 'Complete setup for large teams',
        departments: ['design', 'engineering', 'marketing', 'product', 'project-management', 'studio-operations', 'testing']
      },
      {
        label: '⚙️ Custom Setup',
        description: 'Choose your own departments',
        detail: 'Full customization with guided setup',
        departments: []
      }
    ];

    const selectedPreset = await vscode.window.showQuickPick(presets, {
      placeHolder: 'Choose a quick setup preset',
      title: 'AgentKit Quick Setup'
    });

    if (!selectedPreset) {
      return;
    }

    // If custom, redirect to full init
    if (selectedPreset.departments.length === 0) {
      return initAgentsCommand(context);
    }

    // Use default tool from settings
    const defaultTool = configService.getDefaultTool();
    const folder = TOOLS[defaultTool].folder;

    // Get all agents for selected departments
    const departments = await agentKitService.getDepartments();
    const agents: string[] = [];
    
    selectedPreset.departments.forEach(deptId => {
      const dept = departments[deptId];
      if (dept) {
        dept.agents.forEach((agentName: string) => {
          agents.push(`${deptId}/${agentName}`);
        });
      }
    });

    // Build configuration
    const config: AgentConfig = {
      tool: defaultTool,
      folder,
      departments: selectedPreset.departments,
      agents,
      stack: []
    };

    // Generate agents with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AgentKit: Quick Setup...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Installing agents...' });

        try {
          await agentKitService.generateAgents(config, workspaceFolder.fsPath);

          progress.report({ increment: 100, message: 'Complete!' });

          const action = await vscode.window.showInformationMessage(
            `✅ Quick Setup Complete! Installed ${agents.length} agents`,
            'Open Folder',
            'Done'
          );

          if (action === 'Open Folder') {
            await fileSystemService.revealInExplorer(
              vscode.Uri.joinPath(workspaceFolder, folder).fsPath
            );
          }

          // Refresh tree views
          vscode.commands.executeCommand('agentkit.refreshAgents');

        } catch (error: any) {
          logger.error('Error in quick setup', error);
          vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
        }
      }
    );

  } catch (error: any) {
    logger.error('Error in quickInit command', error);
    vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
  }
}

// Re-export for convenience
async function initAgentsCommand(context: vscode.ExtensionContext): Promise<void> {
  const { initAgentsCommand: init } = await import('./initAgents');
  return init(context);
}
