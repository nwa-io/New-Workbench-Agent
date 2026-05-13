import * as vscode from 'vscode';
import { AgentConfig, TOOLS } from '../../models/AgentConfig';
import { AgentKitService } from '../../services/AgentKitService';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

interface SetupPreset extends vscode.QuickPickItem {
  departments: string[];
}

export class QuickInitCommand extends BaseCommand {
  constructor(
    dependencies: CommandDependencies,
    private readonly runCustomSetup: () => Promise<void>,
    private readonly agentKitService = new AgentKitService()
  ) {
    super(COMMANDS.QUICK_INIT, dependencies);
  }

  async execute(): Promise<void> {
    try {
      const workspaceFolder = await this.dependencies.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
      }

      const selectedPreset = await vscode.window.showQuickPick(this.getPresets(), {
        placeHolder: 'Choose a quick setup preset',
        title: 'NWA Quick Setup'
      });

      if (!selectedPreset) {
        return;
      }

      if (selectedPreset.departments.length === 0) {
        await this.runCustomSetup();
        return;
      }

      const defaultTool = this.dependencies.configService.getDefaultTool();
      const folder = TOOLS[defaultTool].folder;
      const departments = await this.agentKitService.getDepartments();
      const agents: string[] = [];

      selectedPreset.departments.forEach(departmentId => {
        const department = departments[departmentId];
        if (department) {
          department.agents.forEach((agentName: string) => {
            agents.push(`${departmentId}/${agentName}`);
          });
        }
      });

      const config: AgentConfig = {
        tool: defaultTool,
        folder,
        departments: selectedPreset.departments,
        agents,
        stack: []
      };

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NWA: Quick Setup...',
          cancellable: false
        },
        async progress => {
          progress.report({ increment: 0, message: 'Installing agents...' });

          try {
            await this.agentKitService.generateAgents(config, workspaceFolder.fsPath);
            progress.report({ increment: 100, message: 'Complete!' });

            const action = await vscode.window.showInformationMessage(
              `Quick Setup complete. Installed ${agents.length} agents.`,
              'Open Folder',
              'Done'
            );

            if (action === 'Open Folder') {
              await this.dependencies.fileSystemService.revealInExplorer(
                vscode.Uri.joinPath(workspaceFolder, folder).fsPath
              );
            }

            await vscode.commands.executeCommand(COMMANDS.REFRESH_AGENTS);
          } catch (error) {
            logger.error('Error in quick setup', error as Error);
            vscode.window.showErrorMessage(`AgentKit Error: ${(error as Error).message}`);
          }
        }
      );
    } catch (error) {
      logger.error('Error in quick init command', error as Error);
      vscode.window.showErrorMessage(`AgentKit Error: ${(error as Error).message}`);
    }
  }

  private getPresets(): SetupPreset[] {
    return [
      {
        label: 'Full Stack Developer',
        description: 'Engineering + Design + Testing',
        detail: 'Best for solo developers building complete apps',
        departments: ['engineering', 'design', 'testing']
      },
      {
        label: 'Rapid Prototyper',
        description: 'Engineering + Product',
        detail: 'Fast MVP development with product guidance',
        departments: ['engineering', 'product']
      },
      {
        label: 'Design-First',
        description: 'Design + UX + Marketing',
        detail: 'User-centric design and marketing',
        departments: ['design', 'marketing']
      },
      {
        label: 'Growth-Focused',
        description: 'Marketing + Product + Analytics',
        detail: 'User acquisition and growth',
        departments: ['marketing', 'product', 'studio-operations']
      },
      {
        label: 'Enterprise Team',
        description: 'All departments',
        detail: 'Complete setup for large teams',
        departments: ['design', 'engineering', 'marketing', 'product', 'project-management', 'studio-operations', 'testing']
      },
      {
        label: 'Custom Setup',
        description: 'Choose your own departments',
        detail: 'Full customization with guided setup',
        departments: []
      }
    ];
  }
}
