export const EXTENSION_ID = 'nwa-vscode';
export const EXTENSION_NAME = 'NWA';

export const COMMANDS = {
  OPEN_PANEL: 'nwa.openPanel',
  QUICK_INIT: 'nwa.quickInit',
  INIT_AGENTS: 'nwa.initAgents',
  INIT_CLAUDE_RESOURCE: 'nwa.initClaudeResource',
  INIT_CLAUDE_ENVIRONMENT: 'nwa.initClaudeEnvironment',
  GRAPH_OBSIDIAN: 'nwa.graphObsidian',
  OPEN_TASK_MANAGER: 'nwa.openTaskManager',
  OPEN_WORKFLOW_SETTINGS: 'nwa.openWorkflowSettings',
  REFRESH_AGENTS: 'nwa.refreshAgents',
  UPDATE_AGENTS: 'nwa.updateAgents',
  REMOVE_AGENTS: 'nwa.removeAgents',
  VIEW_AGENT: 'nwa.viewAgent',
  OPEN_SETTINGS: 'nwa.openSettings',
  PREVIEW_AGENT: 'nwa.previewAgent',
  TOGGLE_FAVORITE: 'nwa.toggleFavorite',
  MEMORY_ADD: 'nwa.memory.addManualMemory',
  MEMORY_SEARCH: 'nwa.memory.searchMemory',
  MEMORY_SHOW: 'nwa.memory.showMemory',
  MEMORY_CLEAR: 'nwa.memory.clearMemory',
  MEMORY_REFRESH_TREE: 'nwa.memory.refreshTree',
  FIGMA_MCP_BRIDGE_START: 'nwaAgent.startFigmaMcpBridge',
  FIGMA_MCP_BRIDGE_STOP: 'nwaAgent.stopFigmaMcpBridge',
  FIGMA_MCP_BRIDGE_STATUS: 'nwaAgent.showFigmaMcpStatus',
  FIGMA_MCP_BRIDGE_GET_STATUS: 'nwaAgent.getFigmaMcpBridgeStatus'
} as const;

export const CONFIG_KEYS = {
  DEFAULT_TOOL: 'nwa.defaultTool',
  DEFAULT_FOLDER: 'nwa.defaultFolder',
  AUTO_REFRESH: 'nwa.autoRefresh',
  SHOW_WELCOME: 'nwa.showWelcome',
  DEFAULT_DEPARTMENTS: 'nwa.defaultDepartments',
  FAVORITE_AGENTS: 'nwa.favoriteAgents',
  TASK_DOCUMENTS_FOLDER: 'nwa.taskDocumentsFolder'
} as const;

export const TREE_VIEW_IDS = {
  INSTALLED: 'nwa-installed',
  AVAILABLE: 'nwa-available',
  CLAUDECONTEXT: 'nwa-claude-initial-context',
  TASK: 'nwa-task',
  MEMORY: 'nwa-memory'
} as const;

export const GLOBAL_STATE_KEYS = {
  HAS_SHOWN_WELCOME: 'nwa.hasShownWelcome'
} as const;
