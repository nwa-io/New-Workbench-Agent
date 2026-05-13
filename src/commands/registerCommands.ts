import { InitAgentsCommand } from './initAgents/InitAgentsCommand';
import { InitClaudeEnvironmentCommand } from './initClaudeEnvironment/InitClaudeEnvironmentCommand';
import { InitClaudeResourceCommand } from './initClaudeResource/InitClaudeResourceCommand';
import { OpenObsidianGraphCommand } from './openObsidianGraph/OpenObsidianGraphCommand';
import { OpenPanelCommand } from './openPanel/OpenPanelCommand';
import { OpenSettingsCommand } from './openSettings/OpenSettingsCommand';
import { OpenTaskManagerCommand } from './openTaskManager/OpenTaskManagerCommand';
import { OpenWorkflowSettingsCommand } from './openWorkflowSettings/OpenWorkflowSettingsCommand';
import { PreviewAgentCommand } from './previewAgent/PreviewAgentCommand';
import { QuickInitCommand } from './quickInit/QuickInitCommand';
import { RefreshAgentsCommand } from './refreshAgents/RefreshAgentsCommand';
import { RemoveAgentsCommand } from './removeAgents/RemoveAgentsCommand';
import { ToggleFavoriteCommand } from './toggleFavorite/ToggleFavoriteCommand';
import { UpdateAgentsCommand } from './updateAgents/UpdateAgentsCommand';
import { ViewAgentCommand } from './viewAgent/ViewAgentCommand';
import { CommandDependencies, ExtensionCommand } from './types';

export function registerCommands(dependencies: CommandDependencies): void {
  const initAgentsCommand = new InitAgentsCommand(dependencies);
  const commands: ExtensionCommand[] = [
    new OpenPanelCommand(dependencies),
    new QuickInitCommand(dependencies, () => initAgentsCommand.execute()),
    initAgentsCommand,
    new InitClaudeResourceCommand(dependencies),
    new InitClaudeEnvironmentCommand(dependencies),
    new OpenObsidianGraphCommand(dependencies),
    new OpenTaskManagerCommand(dependencies),
    new OpenWorkflowSettingsCommand(dependencies),
    new RefreshAgentsCommand(dependencies),
    new UpdateAgentsCommand(dependencies),
    new RemoveAgentsCommand(dependencies),
    new ViewAgentCommand(dependencies),
    new OpenSettingsCommand(dependencies),
    new PreviewAgentCommand(dependencies),
    new ToggleFavoriteCommand(dependencies)
  ];

  dependencies.context.subscriptions.push(...commands.map(command => command.register()));
}
