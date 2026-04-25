import * as vscode from 'vscode';
import { AgentConfig, TOOLS, ToolType } from '../models/AgentConfig';
import { AgentKitService } from '../services/AgentKitService';
import { FileSystemService } from '../services/FileSystemService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';

export async function initAgentsCommand(context: vscode.ExtensionContext): Promise<void> {
  const fileSystemService = new FileSystemService();
  const agentKitService = new AgentKitService();
  const configService = new ConfigService();

  try {
    const workspaceFolder = await fileSystemService.getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('AgentKit: Please open a workspace folder first');
      return;
    }

    // Step 1: Select tool
    const toolItems = Object.values(TOOLS).map(tool => ({
      label: tool.name,
      description: tool.description,
      detail: `Default folder: ${tool.folder}`,
      tool: tool.id
    }));

    const selectedTool = await vscode.window.showQuickPick(toolItems, {
      placeHolder: 'Select your AI tool',
      title: 'AgentKit Setup - Step 1 of 4'
    });

    if (!selectedTool) {
      return;
    }

    // Step 2: Select departments
    const departments = await agentKitService.getDepartments();
    const deptItems = Object.entries(departments).map(([id, dept]: [string, any]) => ({
      label: dept.name,
      description: `${dept.agents.length} agents`,
      detail: dept.description,
      picked: configService.getDefaultDepartments().includes(id),
      id
    }));

    const selectedDepts = await vscode.window.showQuickPick(deptItems, {
      placeHolder: 'Select departments (multi-select)',
      canPickMany: true,
      title: 'AgentKit Setup - Step 2 of 4'
    });

    if (!selectedDepts || selectedDepts.length === 0) {
      return;
    }

    // Step 3: Select specific agents (optional)
    const allAgents: any[] = [];
    selectedDepts.forEach(dept => {
      const deptData = departments[dept.id];
      deptData.agents.forEach((agentName: string) => {
        allAgents.push({
          label: agentName,
          description: dept.label,
          picked: true,
          id: `${dept.id}/${agentName}`,
          department: dept.id
        });
      });
    });

    const selectedAgents = await vscode.window.showQuickPick(allAgents, {
      placeHolder: 'Select specific agents (or keep all)',
      canPickMany: true,
      title: 'AgentKit Setup - Step 3 of 4'
    });

    if (!selectedAgents || selectedAgents.length === 0) {
      return;
    }

    // Step 4: Custom folder name (optional)
    const defaultFolder = TOOLS[selectedTool.tool as ToolType].folder;
    const customFolder = await vscode.window.showInputBox({
      prompt: 'Custom folder name (optional)',
      placeHolder: defaultFolder,
      value: configService.getDefaultFolder() || defaultFolder,
      title: 'AgentKit Setup - Step 4 of 4'
    });

    const folder = customFolder || defaultFolder;

    // Build configuration
    const config: AgentConfig = {
      tool: selectedTool.tool as ToolType,
      folder,
      departments: selectedDepts.map(d => d.id),
      agents: selectedAgents.map(a => a.id),
      stack: []
    };

    // Generate agents with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AgentKit: Installing agents...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Preparing...' });

        try {
          await agentKitService.generateAgents(config, workspaceFolder.fsPath);

          progress.report({ increment: 100, message: 'Complete!' });

          const action = await vscode.window.showInformationMessage(
            `✅ Successfully installed ${selectedAgents.length} agents!`,
            'Open Folder',
            'View Agents',
            'Done'
          );

          if (action === 'Open Folder') {
            await fileSystemService.revealInExplorer(
              vscode.Uri.joinPath(workspaceFolder, folder).fsPath
            );
          } else if (action === 'View Agents') {
            await vscode.commands.executeCommand('workbench.view.extension.agentkit-sidebar');
          }

          // Refresh tree views
          vscode.commands.executeCommand('agentkit.refreshAgents');

        } catch (error: any) {
          logger.error('Error generating agents', error);
          vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
        }
      }
    );

  } catch (error: any) {
    logger.error('Error in initAgents command', error);
    vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
  }
}
