import * as vscode from 'vscode';
import path from 'path';
import { registerCommands } from './commands/registerCommands';
import { TaskActionsProvider } from './providers/TaskActionsProvider';
import { MemoryTreeProvider } from './providers/MemoryTreeProvider';
import { ComponentBrowserProvider } from './providers/ComponentBrowserProvider';
import { ConfigService } from './services/ConfigService';
import { FileSystemService } from './services/FileSystemService';
import { ComponentScannerService, ScannedComponent } from './services/ComponentScannerService';
import { MemoryService } from './features/memory/MemoryService';
import { logger } from './utils/logger';
import { COMMANDS, CONFIG_KEYS, TREE_VIEW_IDS, GLOBAL_STATE_KEYS } from './utils/constants';
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
  const claudeContextProvider = new ClaudeContextProvider();
  const taskActionsProvider = new TaskActionsProvider();

  const claudeContextTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.CLAUDECONTEXT, {
    treeDataProvider: claudeContextProvider,
    showCollapseAll: true,
  });
  const taskTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.TASK, {
    treeDataProvider: taskActionsProvider,
    showCollapseAll: false,
  });

  const treeViews: vscode.Disposable[] = [claudeContextTreeView, taskTreeView];

  if (memoryProvider) {
    const memoryTreeView = vscode.window.createTreeView(TREE_VIEW_IDS.MEMORY, {
      treeDataProvider: memoryProvider,
      showCollapseAll: false
    });
    treeViews.push(memoryTreeView);
  }

  const componentBrowserProvider = new ComponentBrowserProvider(
    new ComponentScannerService(),
    configService,
    workspaceRoot
  );
  const componentBrowserView = vscode.window.createTreeView(TREE_VIEW_IDS.COMPONENT_BROWSER, {
    treeDataProvider: componentBrowserProvider,
    showCollapseAll: true
  });
  treeViews.push(componentBrowserView);
  void componentBrowserProvider.refresh();

  context.subscriptions.push(...treeViews);

  // Register commands
  registerCommands({
    context,
    fileSystemService,
    configService,
    memoryService,
    memoryProvider
  });

  registerComponentBrowserCommands(context, componentBrowserProvider, configService, workspaceRoot);
  registerFigmaMcpBridgeCommands(context, nwaOutputChannel);
  registerFigmaMcpServerDefinitionProvider(context);
  void startFigmaBridgeIfNeeded(context, nwaOutputChannel, false);

  // Watch the component-path config so the browser refreshes when the user
  // edits scan paths from settings UI / settings.json.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(CONFIG_KEYS.COMPONENT_PATHS)) {
        void componentBrowserProvider.refresh();
      }
    })
  );

  // Re-scan when component source files change so the browser stays current
  // without manual refresh.
  if (workspaceRoot) {
    const componentWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{vue,tsx,jsx,svelte,component.ts}'
    );
    const onChange = (): void => { void componentBrowserProvider.refresh(); };
    componentWatcher.onDidCreate(onChange);
    componentWatcher.onDidDelete(onChange);
    context.subscriptions.push(componentWatcher);
  }

  // Create status bar item
  createStatusBarItem(context);

  logger.info('AgentKit extension activated successfully');
}

function registerComponentBrowserCommands(
  context: vscode.ExtensionContext,
  provider: ComponentBrowserProvider,
  configService: ConfigService,
  workspaceRoot: string | undefined
): void {
  // The TreeView items pass themselves as the command argument when invoked
  // from the context menu. For inline commands (refresh / addPath) there is
  // no argument; we handle both forms.
  const resolveComponent = (arg: unknown): ScannedComponent | undefined => {
    if (arg && typeof arg === 'object' && 'component' in arg) {
      return (arg as { component: ScannedComponent }).component;
    }
    return undefined;
  };
  const resolvePathValue = (arg: unknown): string | undefined => {
    if (arg && typeof arg === 'object' && 'pathValue' in arg) {
      const value = (arg as { pathValue?: string }).pathValue;
      return typeof value === 'string' && value.length > 0 ? value : undefined;
    }
    if (typeof arg === 'string') {
      return arg;
    }
    return undefined;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.COMPONENTS_REFRESH, async () => {
      await provider.refresh();
    }),

    vscode.commands.registerCommand(COMMANDS.COMPONENTS_ADD_PATH, async () => {
      if (!workspaceRoot) {
        void vscode.window.showWarningMessage('Open a workspace folder first.');
        return;
      }
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.Uri.file(workspaceRoot),
        openLabel: 'Add as Component Scan Path'
      });
      if (!picked || picked.length === 0) {
        return;
      }
      const absPath = picked[0].fsPath;
      const rel = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
      if (rel.startsWith('..')) {
        void vscode.window.showWarningMessage('Scan path must live inside the workspace.');
        return;
      }
      await configService.addComponentPath(rel || '.');
      await provider.refresh();
      void vscode.window.showInformationMessage(`Added component scan path: ${rel || '.'}`);
    }),

    vscode.commands.registerCommand(COMMANDS.COMPONENTS_REMOVE_PATH, async (arg: unknown) => {
      const target = resolvePathValue(arg);
      const paths = configService.getComponentPaths();
      let toRemove = target;
      if (!toRemove) {
        toRemove = await vscode.window.showQuickPick(paths, {
          title: 'Remove component scan path',
          placeHolder: 'Pick the path to remove'
        });
      }
      if (!toRemove) {
        return;
      }
      await configService.removeComponentPath(toRemove);
      await provider.refresh();
      void vscode.window.showInformationMessage(`Removed component scan path: ${toRemove}`);
    }),

    vscode.commands.registerCommand(COMMANDS.COMPONENTS_OPEN_FILE, async (arg: unknown) => {
      const component = resolveComponent(arg);
      if (!component) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(component.absolutePath));
      await vscode.window.showTextDocument(doc, { preview: false });
    }),

    vscode.commands.registerCommand(COMMANDS.COMPONENTS_COPY_PATH, async (arg: unknown) => {
      const component = resolveComponent(arg);
      if (!component) {
        return;
      }
      await vscode.env.clipboard.writeText(component.filePath);
      void vscode.window.showInformationMessage(`Copied path: ${component.filePath}`);
    }),

    vscode.commands.registerCommand(COMMANDS.COMPONENTS_COPY_IMPORT, async (arg: unknown) => {
      const component = resolveComponent(arg);
      if (!component) {
        return;
      }
      // Strip the extension and any leading "src/" so the snippet matches
      // typical tsconfig alias setups. Users can adjust after pasting.
      const noExt = component.filePath.replace(/\.[^./]+$/, '');
      const importPath = noExt.replace(/^src\//, '@/');
      const importStmt = component.exportType === 'default'
        ? `import ${component.name} from '${importPath}';`
        : `import { ${component.name} } from '${importPath}';`;
      await vscode.env.clipboard.writeText(importStmt);
      void vscode.window.showInformationMessage('Copied import statement.');
    })
  );
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
