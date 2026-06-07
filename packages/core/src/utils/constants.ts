export const EXTENSION_ID = 'nwa-vscode';
export const EXTENSION_NAME = 'NWA';

export const COMMANDS = {
  OPEN_PANEL: 'nwa.openPanel',
  QUICK_INIT: 'nwa.quickInit',
  INIT_AGENTS: 'nwa.initAgents',
  INIT_CLAUDE_RESOURCE: 'nwa.initClaudeResource',
  INIT_CLAUDE_ENVIRONMENT: 'nwa.initClaudeEnvironment',
  OPEN_TASK_MANAGER: 'nwa.openTaskManager',
  OPEN_WORKFLOW_SETTINGS: 'nwa.openWorkflowSettings',
  OPEN_WORKFLOWS: 'nwa.openWorkflows',
  VIEW_AGENT: 'nwa.viewAgent',
  OPEN_SETTINGS: 'nwa.openSettings',
  PREVIEW_AGENT: 'nwa.previewAgent',
  MEMORY_ADD: 'nwa.memory.addManualMemory',
  MEMORY_SEARCH: 'nwa.memory.searchMemory',
  MEMORY_SHOW: 'nwa.memory.showMemory',
  MEMORY_CLEAR: 'nwa.memory.clearMemory',
  MEMORY_REFRESH_TREE: 'nwa.memory.refreshTree',
  FIGMA_MCP_BRIDGE_START: 'nwaAgent.startFigmaMcpBridge',
  FIGMA_MCP_BRIDGE_STOP: 'nwaAgent.stopFigmaMcpBridge',
  FIGMA_MCP_BRIDGE_STATUS: 'nwaAgent.showFigmaMcpStatus',
  FIGMA_MCP_BRIDGE_GET_STATUS: 'nwaAgent.getFigmaMcpBridgeStatus',
  COMPONENTS_REFRESH: 'nwa.components.refresh',
  COMPONENTS_ADD_PATH: 'nwa.components.addPath',
  COMPONENTS_REMOVE_PATH: 'nwa.components.removePath',
  COMPONENTS_OPEN_FILE: 'nwa.components.openFile',
  COMPONENTS_COPY_PATH: 'nwa.components.copyPath',
  COMPONENTS_COPY_IMPORT: 'nwa.components.copyImport'
} as const;

export const CONFIG_KEYS = {
  DEFAULT_TOOL: 'nwa.defaultTool',
  DEFAULT_FOLDER: 'nwa.defaultFolder',
  AUTO_REFRESH: 'nwa.autoRefresh',
  SHOW_WELCOME: 'nwa.showWelcome',
  DEFAULT_DEPARTMENTS: 'nwa.defaultDepartments',
  FAVORITE_AGENTS: 'nwa.favoriteAgents',
  TASK_DOCUMENTS_FOLDER: 'nwa.taskDocumentsFolder',
  COMPONENT_PATHS: 'nwa.componentPaths'
} as const;

export const DEFAULT_COMPONENT_PATHS = [
  'src/components',
  'src/atoms',
  'src/molecules',
  'src/organisms',
  'src/shared/components',
  'src/ui'
];

export const TREE_VIEW_IDS = {
  CLAUDECONTEXT: 'nwa-claude-initial-context',
  TASK: 'nwa-task',
  MEMORY: 'nwa-memory',
  COMPONENT_BROWSER: 'nwa-component-browser'
} as const;

export const GLOBAL_STATE_KEYS = {
  HAS_SHOWN_WELCOME: 'nwa.hasShownWelcome'
} as const;
