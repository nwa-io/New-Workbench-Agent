export const EXTENSION_ID = 'agentkit-vscode';
export const EXTENSION_NAME = 'AgentKit';

export const COMMANDS = {
  OPEN_PANEL: 'agentkit.openPanel',
  QUICK_INIT: 'agentkit.quickInit',
  INIT_AGENTS: 'agentkit.initAgents',
  INIT_CLAUDE_RESOURCE: 'agentkit.initClaudeResource',
  INIT_CLAUDE_ENVIRONMENT: 'agentkit.initClaudeEnvironment',
  GRAPH_OBSIDIAN: 'agentkit.graphObsidian',
  OPEN_TASK_MANAGER: 'agentkit.openTaskManager',
  OPEN_FIX_BUG_MANAGER: 'agentkit.openFixBugManager',
  REFRESH_AGENTS: 'agentkit.refreshAgents',
  UPDATE_AGENTS: 'agentkit.updateAgents',
  REMOVE_AGENTS: 'agentkit.removeAgents',
  VIEW_AGENT: 'agentkit.viewAgent',
  OPEN_SETTINGS: 'agentkit.openSettings',
  PREVIEW_AGENT: 'agentkit.previewAgent',
  TOGGLE_FAVORITE: 'agentkit.toggleFavorite'
} as const;

export const CONFIG_KEYS = {
  DEFAULT_TOOL: 'agentkit.defaultTool',
  DEFAULT_FOLDER: 'agentkit.defaultFolder',
  AUTO_REFRESH: 'agentkit.autoRefresh',
  SHOW_WELCOME: 'agentkit.showWelcome',
  DEFAULT_DEPARTMENTS: 'agentkit.defaultDepartments',
  FAVORITE_AGENTS: 'agentkit.favoriteAgents',
  TASK_DOCUMENTS_FOLDER: 'agentkit.taskDocumentsFolder'
} as const;

export const TREE_VIEW_IDS = {
  INSTALLED: 'agentkit-installed',
  AVAILABLE: 'agentkit-available',
  CLAUDECONTEXT: 'agentkit-claude-initial-context',
  TASK: 'agentkit-task'
} as const;

export const GLOBAL_STATE_KEYS = {
  HAS_SHOWN_WELCOME: 'agentkit.hasShownWelcome'
} as const;
