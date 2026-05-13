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
  TOGGLE_FAVORITE: 'nwa.toggleFavorite'
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
  TASK: 'nwa-task'
} as const;

export const GLOBAL_STATE_KEYS = {
  HAS_SHOWN_WELCOME: 'nwa.hasShownWelcome'
} as const;
