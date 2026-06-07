import { InitAgentsCommand } from './initAgents/InitAgentsCommand';
import { InitClaudeEnvironmentCommand } from './initClaudeEnvironment/InitClaudeEnvironmentCommand';
import { InitClaudeResourceCommand } from './initClaudeResource/InitClaudeResourceCommand';
import { OpenPanelCommand } from './openPanel/OpenPanelCommand';
import { OpenSettingsCommand } from './openSettings/OpenSettingsCommand';
import { OpenTaskManagerCommand } from './openTaskManager/OpenTaskManagerCommand';
import { OpenWorkflowSettingsCommand } from './openWorkflowSettings/OpenWorkflowSettingsCommand';
import { OpenWorkflowsCommand } from './openWorkflows/OpenWorkflowsCommand';
import { PreviewAgentCommand } from './previewAgent/PreviewAgentCommand';
import { QuickInitCommand } from './quickInit/QuickInitCommand';
import { ViewAgentCommand } from './viewAgent/ViewAgentCommand';
import {
  AddManualMemoryCommand,
  ClearMemoryCommand,
  RefreshMemoryTreeCommand,
  SearchMemoryCommand,
  ShowMemoryCommand
} from './memoryCommands';
import { CommandDependencies, ExtensionCommand } from './types';

export function registerCommands(dependencies: CommandDependencies): void {
  const initAgentsCommand = new InitAgentsCommand(dependencies);
  const commands: ExtensionCommand[] = [
    new OpenPanelCommand(dependencies),
    new QuickInitCommand(dependencies, () => initAgentsCommand.execute()),
    initAgentsCommand,
    new InitClaudeResourceCommand(dependencies),
    new InitClaudeEnvironmentCommand(dependencies),
    new OpenTaskManagerCommand(dependencies),
    new OpenWorkflowSettingsCommand(dependencies),
    new OpenWorkflowsCommand(dependencies),
    new ViewAgentCommand(dependencies),
    new OpenSettingsCommand(dependencies),
    new PreviewAgentCommand(dependencies),
    new AddManualMemoryCommand(dependencies),
    new SearchMemoryCommand(dependencies),
    new ShowMemoryCommand(dependencies),
    new ClearMemoryCommand(dependencies),
    new RefreshMemoryTreeCommand(dependencies)
  ];

  dependencies.context.subscriptions.push(...commands.map(command => command.register()));
}
