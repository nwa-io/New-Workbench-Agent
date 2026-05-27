import * as vscode from 'vscode';
import path from 'path';
import { registerCommands } from './commands/registerCommands';
import { InstalledAgentsProvider } from './providers/InstalledAgentsProvider';
import { AvailableAgentsProvider } from './providers/AvailableAgentsProvider';
import { TaskActionsProvider } from './providers/TaskActionsProvider';
import { MemoryTreeProvider } from './providers/MemoryTreeProvider';
import { ConfigService } from './services/ConfigService';
import { FileSystemService } from './services/FileSystemService';
import { MemoryService } from './features/memory/MemoryService';
import { logger } from './utils/logger';
import { COMMANDS, TREE_VIEW_IDS, GLOBAL_STATE_KEYS } from './utils/constants';
import { ClaudeContextProvider } from './providers/ClaudeContextProvider';
import { startFigmaWebSocketBridge } from './figmaBridge/startFigmaWebSocketBridge';
import { FIGMA_BRIDGE_PORT, FIGMA_BRIDGE_URL, FigmaBridgeStatus, FigmaWebSocketBridge } from './figmaBridge/types';
import { getFigmaContextPath } from './shared/figmaStore';

let figmaBridge: FigmaWebSocketBridge | undefined;

export function activate(context: vscode.ExtensionContext) {
  const nwaOutputChannel = vscode.window.createOutputChannel('NWA Agent');
  context.subscriptions.push(nwaOutputChannel);

  const configService = new ConfigService();
  const fileSystemService = new FileSystemService();

  // Show welcome message on first activation
  showWelcomeMessageIfNeeded(context, configService);

  // Initialize memory service if a workspace is open
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let memoryService: MemoryService | undefined;
  let memoryProvider: MemoryTreeProvider | undefined;

  if (workspaceRoot) {
    memoryService = new MemoryService(workspaceRoot);
    memoryService.initialize().catch(err =>
      logger.error('Failed to initialize memory service', err)
    );
    memoryProvider = new MemoryTreeProvider(memoryService);
    memoryProvider.refresh().catch(() => undefined);
  }

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

  const treeViews: vscode.Disposable[] = [installedTreeView, availableTreeView, claudeContextTreeView, taskTreeView];

  if (memoryProvider) {
    const memoryTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.MEMORY, {
      treeDataProvider: memoryProvider,
      showCollapseAll: false
    });
    treeViews.push(memoryTreeView);
  }

  context.subscriptions.push(...treeViews);

  // Register commands
  registerCommands({
    context,
    installedProvider: installedAgentsProvider,
    availableProvider: availableAgentsProvider,
    fileSystemService,
    configService,
    memoryService,
    memoryProvider
  });

  registerFigmaMcpBridgeCommands(context, nwaOutputChannel);
  registerFigmaMcpServerDefinitionProvider(context);
  void startFigmaBridgeIfNeeded(context, nwaOutputChannel, false);

  // Setup file watchers
  setupFileWatchers(context, installedAgentsProvider);

  // Create status bar item
  createStatusBarItem(context);

  logger.info('AgentKit extension activated successfully');
}

function registerFigmaMcpBridgeCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.FIGMA_MCP_BRIDGE_START, async () => {
      return await startFigmaBridgeIfNeeded(context, outputChannel, true);
    }),
    vscode.commands.registerCommand(COMMANDS.FIGMA_MCP_BRIDGE_STOP, async () => {
      return await stopFigmaBridgeIfRunning(outputChannel, true);
    }),
    vscode.commands.registerCommand(COMMANDS.FIGMA_MCP_BRIDGE_STATUS, async () => {
      return await showFigmaBridgeStatus(outputChannel);
    }),
    vscode.commands.registerCommand(COMMANDS.FIGMA_MCP_BRIDGE_GET_STATUS, () => {
      return getFigmaBridgeStatus();
    })
  );
}

function registerFigmaMcpServerDefinitionProvider(context: vscode.ExtensionContext): void {
  const figmaContextPath = getFigmaContextPath(context);
  const mcpServerPath = path.join(context.extensionUri.fsPath, 'dist', 'mcp', 'server.js');
  const extensionVersion = String(context.extension.packageJSON.version ?? '0.1.0');

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('nwaAgent.figmaMcpProvider', {
      provideMcpServerDefinitions: async () => {
        const env = {
          ['FIGMA_CONTEXT_PATH']: figmaContextPath,
          ['NWA_AGENT_MCP_MODE']: 'vscode-extension'
        };
        const server = new vscode.McpStdioServerDefinition(
          'NWA Agent Figma MCP',
          process.execPath,
          [mcpServerPath],
          env,
          extensionVersion
        );
        server.cwd = context.extensionUri;
        return [server];
      },
      resolveMcpServerDefinition: async server => server
    })
  );
}

async function startFigmaBridgeIfNeeded(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  showInstruction: boolean
): Promise<FigmaBridgeStatus> {
  if (figmaBridge) {
    outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge is already running at ${FIGMA_BRIDGE_URL}`);
    if (showInstruction) {
      await showFigmaBridgeStatus(outputChannel);
    }
    return getFigmaBridgeStatus();
  }

  try {
    figmaBridge = await startFigmaWebSocketBridge(context, outputChannel);
    if (showInstruction) {
      await showFigmaBridgeStatus(outputChannel);
    }
    return getFigmaBridgeStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[${new Date().toISOString()}] Failed to start Figma MCP bridge: ${message}`);
    outputChannel.show();
    void vscode.window.showErrorMessage(`Failed to start Figma MCP bridge on ${FIGMA_BRIDGE_URL}: ${message}`);
    return getFigmaBridgeStatus();
  }
}

async function stopFigmaBridgeIfRunning(
  outputChannel: vscode.OutputChannel,
  showMessage: boolean
): Promise<FigmaBridgeStatus> {
  if (!figmaBridge) {
    outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge is not running`);
    if (showMessage) {
      void vscode.window.showInformationMessage('Figma MCP bridge is not running.');
    }
    return getFigmaBridgeStatus();
  }

  try {
    await figmaBridge.stop();
    figmaBridge = undefined;
    outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge stopped`);
    if (showMessage) {
      void vscode.window.showInformationMessage('Figma MCP bridge stopped.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[${new Date().toISOString()}] Failed to stop Figma MCP bridge: ${message}`);
    outputChannel.show();
    void vscode.window.showErrorMessage(`Failed to stop Figma MCP bridge: ${message}`);
  }

  return getFigmaBridgeStatus();
}

async function showFigmaBridgeStatus(outputChannel: vscode.OutputChannel): Promise<FigmaBridgeStatus> {
  const status = getFigmaBridgeStatus();

  outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge status: ${JSON.stringify(status, null, 2)}`);
  outputChannel.appendLine(getFigmaBridgeInstructions());
  outputChannel.show();

  await vscode.window.showInformationMessage(
    'MCP/Figma bridge is ready. Use Server Address ws://localhost and Port 8080 in the Figma plugin, then click Connect to Server. This VS Code extension registers the MCP server automatically. No Cursor MCP configuration is required.'
  );

  return status;
}

function getFigmaBridgeInstructions(): string {
  return [
    'MCP/Figma bridge is ready.',
    '',
    'Use this configuration in the Figma plugin:',
    '',
    'Server Address:',
    'ws://localhost',
    '',
    'Port:',
    '8080',
    '',
    'Then click:',
    'Connect to Server',
    '',
    'This VS Code extension registers the MCP server automatically.',
    'No Cursor MCP configuration is required.'
  ].join('\n');
}

function getFigmaBridgeStatus(): FigmaBridgeStatus {
  return figmaBridge?.getStatus() ?? {
    running: false,
    connected: false,
    port: FIGMA_BRIDGE_PORT,
    url: FIGMA_BRIDGE_URL
  };
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

export async function deactivate(): Promise<void> {
  if (figmaBridge) {
    try {
      await figmaBridge.stop();
    } catch (error) {
      logger.error('Failed to stop Figma MCP bridge during deactivation', error as Error);
    } finally {
      figmaBridge = undefined;
    }
  }

  logger.info('NWA extension deactivated');
  logger.dispose();
}
