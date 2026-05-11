import * as vscode from 'vscode';
import { AgentKitPanel } from './webview/AgentKitPanel';
import { initAgentsCommand } from './commands/initAgents';
import { quickInitCommand } from './commands/quickPick';
import { refreshAgentsCommand } from './commands/refreshAgents';
import { updateAgentsCommand } from './commands/updateAgents';
import { removeAgentsCommand } from './commands/removeAgents';
import { previewAgentCommand } from './commands/previewAgent';
import { toggleFavoriteCommand } from './commands/toggleFavorite';
import { initClaudeResourceCommand } from './commands/initClaudeResource';
import { initClaudeEnvironmentCommand } from './commands/initClaudeEnvironment';
import { openObsidianGraphCommand } from './commands/openObsidianGraph';
import { TaskManagerPanel } from './webview/TaskManagerPanel';
import { WorkflowSettingsPanel } from './features/workflows/WorkflowSettingsPanel';
import { InstalledAgentsProvider } from './providers/InstalledAgentsProvider';
import { AvailableAgentsProvider } from './providers/AvailableAgentsProvider';
import { TaskActionsProvider } from './providers/TaskActionsProvider';
import { ConfigService } from './services/ConfigService';
import { FileSystemService } from './services/FileSystemService';
import { logger } from './utils/logger';
import { COMMANDS, TREE_VIEW_IDS, GLOBAL_STATE_KEYS } from './utils/constants';
import path from 'path';
import { ClaudeContextProvider } from './providers/ClaudeContextProvider';

export function activate(context: vscode.ExtensionContext) {
  const configService = new ConfigService();
  const fileSystemService = new FileSystemService();

  // Show welcome message on first activation
  showWelcomeMessageIfNeeded(context, configService);

  // Register tree data providers
  const installedAgentsProvider = new InstalledAgentsProvider();
  const availableAgentsProvider = new AvailableAgentsProvider(configService);
  const claudeContextProvider = new ClaudeContextProvider();
  const taskActionsProvider = new TaskActionsProvider();

  const installedTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.INSTALLED, {
    treeDataProvider: installedAgentsProvider,
    showCollapseAll: true,
  });

  const availableTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.AVAILABLE, {
    treeDataProvider: availableAgentsProvider,
    showCollapseAll: true,
  });
  const claudeContextTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.CLAUDECONTEXT, {
    treeDataProvider: claudeContextProvider,
    showCollapseAll: true,
  });
  const taskTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.TASK, {
    treeDataProvider: taskActionsProvider,
    showCollapseAll: false,
  });

  context.subscriptions.push(installedTreeView, availableTreeView, claudeContextTreeView, taskTreeView);

  // Register commands
  registerCommands(context, installedAgentsProvider, availableAgentsProvider, fileSystemService, configService);

  // Setup file watchers
  setupFileWatchers(context, installedAgentsProvider);

  // Create status bar item
  createStatusBarItem(context);

  logger.info('AgentKit extension activated successfully');
}

function registerCommands(
  context: vscode.ExtensionContext,
  installedProvider: InstalledAgentsProvider,
  availableProvider: AvailableAgentsProvider,
  fileSystemService: FileSystemService,
  configService: ConfigService
) {
  context.subscriptions.push(
    // Open Panel
    vscode.commands.registerCommand(COMMANDS.OPEN_PANEL, () => {
      logger.info('Opening AgentKit panel');
      AgentKitPanel.createOrShow(context.extensionUri, configService);
    }),

    // Quick Init
    vscode.commands.registerCommand(COMMANDS.QUICK_INIT, () => {
      logger.info('Starting quick init');
      quickInitCommand(context);
    }),

    // Init Agents
    vscode.commands.registerCommand(COMMANDS.INIT_AGENTS, () => {
      logger.info('Starting init agents');
      initAgentsCommand(context);
    }),

    // Init Claude Resource
    vscode.commands.registerCommand(COMMANDS.INIT_CLAUDE_RESOURCE, () => {
      logger.info('Opening Claude resource initializer');
      initClaudeResourceCommand(context.extensionUri);
    }),

    // Init Claude Environment
    vscode.commands.registerCommand(COMMANDS.INIT_CLAUDE_ENVIRONMENT, async () => {
      logger.info('Initializing Claude environment');
      await initClaudeEnvironmentCommand();
    }),

    // Graph Obsidian
    vscode.commands.registerCommand(COMMANDS.GRAPH_OBSIDIAN, async () => {
      logger.info('Opening Graph Obsidian');
      await openObsidianGraphCommand(context.extensionUri);
    }),

    // Open Task Manager
    vscode.commands.registerCommand(COMMANDS.OPEN_TASK_MANAGER, () => {
      logger.info('Opening Task Manager');
      TaskManagerPanel.createOrShow(context.extensionUri, configService, 'task', context.globalStorageUri);
    }),

    // Open Fix Bug Manager
    vscode.commands.registerCommand(COMMANDS.OPEN_FIX_BUG_MANAGER, () => {
      logger.info('Opening Fix Bug Manager');
      TaskManagerPanel.createOrShow(context.extensionUri, configService, 'fix-bug', context.globalStorageUri);
    }),

    // Open Workflow Settings
    vscode.commands.registerCommand(COMMANDS.OPEN_WORKFLOW_SETTINGS, () => {
      logger.info('Opening Workflow Settings');
      WorkflowSettingsPanel.createOrShow();
    }),

    // Refresh Agents
    vscode.commands.registerCommand(COMMANDS.REFRESH_AGENTS, () => {
      logger.info('Refreshing agents');
      installedProvider.refresh();
      availableProvider.refresh();
      refreshAgentsCommand();
    }),

    // Update Agents
    vscode.commands.registerCommand(COMMANDS.UPDATE_AGENTS, async () => {
      logger.info('Updating agents');
      await updateAgentsCommand();
    }),

    // Remove Agents
    vscode.commands.registerCommand(COMMANDS.REMOVE_AGENTS, async () => {
      logger.info('Removing agents');
      await removeAgentsCommand();
    }),

    // View Agent
    vscode.commands.registerCommand(COMMANDS.VIEW_AGENT, async (agentPath: string) => {
      logger.info('Viewing agent', agentPath);
      
      if (agentPath && typeof agentPath === 'string') {
        try {
          await fileSystemService.openFile(agentPath);
        } catch (error) {
          logger.error('Error opening agent file', error as Error);
          vscode.window.showErrorMessage(`Failed to open agent: ${path.basename(agentPath)}`);
        }
      } else {
        vscode.window.showWarningMessage('No agent file selected');
      }
    }),

    // Open Settings
    vscode.commands.registerCommand(COMMANDS.OPEN_SETTINGS, () => {
      logger.info('Opening settings');
      vscode.commands.executeCommand(
        'workbench.action.openSettings'
      );
    }),

    // Preview Agent (for available agents)
    vscode.commands.registerCommand(COMMANDS.PREVIEW_AGENT, async (departmentId: string, agentName: string) => {
      await previewAgentCommand(departmentId, agentName);
    }),

    // Toggle Favorite
    vscode.commands.registerCommand(COMMANDS.TOGGLE_FAVORITE, async (treeItem) => {
      await toggleFavoriteCommand(treeItem, configService, availableProvider);
    })
  );
}

function setupFileWatchers(
  context: vscode.ExtensionContext,
  installedProvider: InstalledAgentsProvider
) {
  const configService = new ConfigService();

  if (!configService.getAutoRefresh()) {
    logger.info('Auto-refresh is disabled');
    return;
  }

  // Watch for changes in agent folders
  const patterns = [
    '**/.cursorrules/**/*.md',
    '**/.claude/**/*.md',
    '**/.aider/**/*.md',
    '**/.github/copilot-instructions.md',
    '**/.ai/**/*.md'
  ];

  patterns.forEach(pattern => {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(() => {
      logger.debug('File changed, refreshing');
      installedProvider.refresh();
    });

    watcher.onDidCreate(() => {
      logger.debug('File created, refreshing');
      installedProvider.refresh();
    });

    watcher.onDidDelete(() => {
      logger.debug('File deleted, refreshing');
      installedProvider.refresh();
    });

    context.subscriptions.push(watcher);
  });

  logger.info('File watchers set up');
}

function createStatusBarItem(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.command = COMMANDS.OPEN_PANEL;
  statusBarItem.text = '$(robot) NWA';
  statusBarItem.tooltip = 'Open NWA Manager';
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);
  logger.info('Status bar item created');
}

async function showWelcomeMessageIfNeeded(
  context: vscode.ExtensionContext,
  configService: ConfigService
) {
  const hasShownWelcome = context.globalState.get(GLOBAL_STATE_KEYS.HAS_SHOWN_WELCOME);
  const showWelcome = configService.getShowWelcome();

  if (!hasShownWelcome && showWelcome) {
    logger.info('Showing welcome message');

    const answer = await vscode.window.showInformationMessage(
      '👋 Welcome to New Workbench Agent!\n\nSet up AI agents for your development workflow now?',
      { modal: false },
      'Quick Setup',
      'Custom Setup'
    );

    if (answer === 'Quick Setup') {
      vscode.commands.executeCommand(COMMANDS.QUICK_INIT);
    } else if (answer === 'Custom Setup') {
      vscode.commands.executeCommand(COMMANDS.OPEN_PANEL);
    }

    // Mark as shown regardless of choice
    context.globalState.update(GLOBAL_STATE_KEYS.HAS_SHOWN_WELCOME, true);
  }
}

export function deactivate() {
  logger.info('NWA extension deactivated');
  logger.dispose();
}
