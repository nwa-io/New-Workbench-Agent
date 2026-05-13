import * as vscode from 'vscode';
import { AgentConfig, TOOLS, ToolType } from '../../models/AgentConfig';
import { AgentKitService } from '../../services/AgentKitService';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

interface ToolQuickPickItem extends vscode.QuickPickItem {
  tool: ToolType;
}

interface DepartmentQuickPickItem extends vscode.QuickPickItem {
  id: string;
}

interface AgentQuickPickItem extends vscode.QuickPickItem {
  id: string;
  department: string;
}

export class InitAgentsCommand extends BaseCommand {
  constructor(
    dependencies: CommandDependencies,
    private readonly agentKitService = new AgentKitService()
  ) {
    super(COMMANDS.INIT_AGENTS, dependencies);
  }

  async execute(): Promise<void> {
    try {
      const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
      }

      const selectedTool = await this.pickTool();
      if (!selectedTool) {
        return;
      }

      const departments = await this.agentKitService.getDepartments();
      const selectedDepartments = await this.pickDepartments(departments);
      if (!selectedDepartments || selectedDepartments.length === 0) {
        return;
      }

      const selectedAgents = await this.pickAgents(departments, selectedDepartments);
      if (!selectedAgents || selectedAgents.length === 0) {
        return;
      }

      const defaultFolder = TOOLS[selectedTool.tool].folder;
      const customFolder = await vscode.window.showInputBox({
        prompt: 'Custom folder name (optional)',
        placeHolder: defaultFolder,
        value: this.dependencies.configService.getDefaultFolder() || defaultFolder,
        title: 'NWA Setup - Step 4 of 4'
      });

      const folder = customFolder || defaultFolder;
      const config: AgentConfig = {
        tool: selectedTool.tool,
        folder,
        departments: selectedDepartments.map(department => department.id),
        agents: selectedAgents.map(agent => agent.id),
        stack: []
      };

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NWA: Installing agents...',
          cancellable: false
        },
        async progress => {
          progress.report({ increment: 0, message: 'Preparing...' });

          try {
            await this.agentKitService.generateAgents(config, workspaceFolder.fsPath);
            progress.report({ increment: 100, message: 'Complete!' });

            const action = await vscode.window.showInformationMessage(
              `Successfully installed ${selectedAgents.length} agents!`,
              'Open Folder',
              'View Agents',
              'Done'
            );

            if (action === 'Open Folder') {
              await this.dependencies.fileSystemService.revealInExplorer(
                vscode.Uri.joinPath(workspaceFolder, folder).fsPath
              );
            } else if (action === 'View Agents') {
              await vscode.commands.executeCommand('workbench.view.extension.agentkit-sidebar');
            }

            await vscode.commands.executeCommand(COMMANDS.REFRESH_AGENTS);
          } catch (error) {
            logger.error('Error generating agents', error as Error);
            vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
          }
        }
      );
    } catch (error) {
      logger.error('Error in init agents command', error as Error);
      vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
    }
  }

  private async pickTool(): Promise<ToolQuickPickItem | undefined> {
    const toolItems: ToolQuickPickItem[] = Object.values(TOOLS).map(tool => ({
      label: tool.name,
      description: tool.description,
      detail: `Default folder: ${tool.folder}`,
      tool: tool.id
    }));

    return vscode.window.showQuickPick(toolItems, {
      placeHolder: 'Select your AI tool',
      title: 'NWA Setup - Step 1 of 4'
    });
  }

  private async pickDepartments(departments: Record<string, any>): Promise<DepartmentQuickPickItem[] | undefined> {
    const departmentItems: DepartmentQuickPickItem[] = Object.entries(departments).map(([id, department]) => ({
      label: department.name,
      description: `${department.agents.length} agents`,
      detail: department.description,
      picked: this.dependencies.configService.getDefaultDepartments().includes(id),
      id
    }));

    return vscode.window.showQuickPick(departmentItems, {
      placeHolder: 'Select departments (multi-select)',
      canPickMany: true,
      title: 'NWA Setup - Step 2 of 4'
    });
  }

  private async pickAgents(
    departments: Record<string, any>,
    selectedDepartments: readonly DepartmentQuickPickItem[]
  ): Promise<AgentQuickPickItem[] | undefined> {
    const agentItems: AgentQuickPickItem[] = [];

    selectedDepartments.forEach(department => {
      const departmentData = departments[department.id];
      departmentData.agents.forEach((agentName: string) => {
        agentItems.push({
          label: agentName,
          description: department.label,
          picked: true,
          id: `${department.id}/${agentName}`,
          department: department.id
        });
      });
    });

    return vscode.window.showQuickPick(agentItems, {
      placeHolder: 'Select specific agents (or keep all)',
      canPickMany: true,
      title: 'NWA Setup - Step 3 of 4'
    });
  }
}
