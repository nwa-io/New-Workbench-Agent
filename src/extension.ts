import * as vscode from 'vscode';
import { registerCommands } from './commands/registerCommands';
import { InstalledAgentsProvider } from './providers/InstalledAgentsProvider';
import { AvailableAgentsProvider } from './providers/AvailableAgentsProvider';
import { TaskActionsProvider } from './providers/TaskActionsProvider';
import { ConfigService } from './services/ConfigService';
import { FileSystemService } from './services/FileSystemService';
import { logger } from './utils/logger';
import { COMMANDS, TREE_VIEW_IDS, GLOBAL_STATE_KEYS } from './utils/constants';
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
  registerCommands({
    context,
    installedProvider: installedAgentsProvider,
    availableProvider: availableAgentsProvider,
    fileSystemService,
    configService
  });

  // Setup file watchers
  setupFileWatchers(context, installedAgentsProvider);

  // Create status bar item
  createStatusBarItem(context);

  logger.info('AgentKit extension activated successfully');
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
