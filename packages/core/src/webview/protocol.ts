/**
 * Typed message contracts shared between the extension host and the React
 * webview apps. This module is **framework-free and type-only** (no `vscode`,
 * no DOM, no React) so it can be imported by both the Node extension build and
 * the browser webview build.
 *
 * One discriminated union per direction, per panel. As more panels migrate to
 * React they add their own message unions here.
 */

import type {
  WorkflowFile,
  WorkflowStatus,
  ModelOption,
  TaskManagerMode,
  TaskManagerState,
  TaskManagerItem,
  TaskItemType,
  TaskDocument,
  TaskJiraConnection
} from '@nwa/workflow-sdk';

// ---------------------------------------------------------------------------
// Claude Resource panel
// ---------------------------------------------------------------------------

export interface ClaudeResourceDescriptor {
  id: string;
  /** Display name shown on the checkbox, e.g. "claude.md". */
  label: string;
  /** Which layer group the resource belongs to (1-based). */
  layer: number;
}

export interface ClaudeResourceLayer {
  /** 1-based layer number, matches {@link ClaudeResourceDescriptor.layer}. */
  layer: number;
  /** Group heading, e.g. "Layer 1". */
  title: string;
  /** Group subtitle, e.g. "Auto-loaded Rules". */
  name: string;
}

/** Messages the host sends down to the Claude Resource webview. */
export type ClaudeResourceHostMessage =
  | {
      command: 'claudeResourceCatalog';
      data: { layers: ClaudeResourceLayer[]; resources: ClaudeResourceDescriptor[] };
    }
  | { command: 'installClaudeResourcesComplete' }
  | { command: 'installClaudeResourcesFailed' };

/** Messages the Claude Resource webview sends up to the host. */
export type ClaudeResourceWebviewMessage =
  | { command: 'ready' }
  | { command: 'installClaudeResources'; resources: string[] };

// ---------------------------------------------------------------------------
// Workflow Settings panel (Core settings + Workflow builder)
// ---------------------------------------------------------------------------

export type WorkflowSettingsTab = 'core' | 'workflows';

export interface CliToolStatusView {
  id: string;
  label: string;
  installed: boolean;
  authenticated: boolean;
  version?: string;
  message?: string;
}

export interface SavePathSettingView {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
  editable?: boolean;
  configKey?: string;
}

export interface CoreSettingsView {
  savePaths: SavePathSettingView[];
  cliStatuses: CliToolStatusView[];
}

/** Identifies a block position inside a workflow (root step/group or a parallel child). */
export type WorkflowLocator =
  | { type: 'root'; index: number }
  | { type: 'parallel-child'; parentIndex: number; childIndex: number };

/** Messages the host sends down to the Workflow Settings webview. */
export type WorkflowSettingsHostMessage =
  | { command: 'setActiveTab'; data: { tab: WorkflowSettingsTab } }
  | {
      command: 'setState';
      data: { workflows: WorkflowFile[]; activeId: string | null; availableModels: ModelOption[] };
    }
  | { command: 'setCoreSettings'; data: CoreSettingsView }
  | { command: 'coreSettingsSaved'; data: CoreSettingsView; statusId: string; message: string }
  | { command: 'coreSettingsError'; statusId: string; message: string };

/** Messages the Workflow Settings webview sends up to the host. */
export type WorkflowSettingsWebviewMessage =
  | { command: 'ready'; data?: Record<string, never> }
  | { command: 'saveTaskDocumentsFolder'; data: { value: string } }
  | { command: 'resetTaskDocumentsFolder'; data?: Record<string, never> }
  | { command: 'refreshCliStatus'; data?: Record<string, never> }
  | { command: 'installCli'; data: { id: string } }
  | { command: 'authenticateCli'; data: { id: string } }
  | { command: 'selectWorkflow'; data: { id: string } }
  | { command: 'createWorkflow'; data?: Record<string, never> }
  | { command: 'renameWorkflow'; data: { id: string } }
  | { command: 'renameWorkflowInline'; data: { id: string; name: string } }
  | { command: 'deleteWorkflow'; data: { id: string } }
  | { command: 'addStep'; data: { workflowId: string; locator: WorkflowLocator } }
  | { command: 'addParallelGroup'; data: { workflowId: string } }
  | { command: 'addParallelChild'; data: { workflowId: string; parentIndex: number } }
  | { command: 'deleteBlock'; data: { workflowId: string; locator: WorkflowLocator } }
  | { command: 'setStepModel'; data: { workflowId: string; locator: WorkflowLocator; model: string } }
  | { command: 'setStepSpeed'; data: { workflowId: string; locator: WorkflowLocator; speed: string } }
  | { command: 'validateWorkflow'; data: { id: string } }
  | { command: 'importWorkflow'; data?: Record<string, never> }
  | { command: 'exportWorkflow'; data: { id: string } };

// ---------------------------------------------------------------------------
// Agent Manager panel
// ---------------------------------------------------------------------------

export interface DepartmentView {
  name: string;
  description: string;
  agents: string[];
}

export interface AgentInstallRequest {
  tool: string;
  folder: string;
  departments: string[];
  agents: string[];
  model?: string;
}

/** Messages the host sends down to the Agent Manager webview. */
export type AgentManagerHostMessage =
  | { command: 'departmentsData'; data: Record<string, DepartmentView> }
  | { command: 'favoritesData'; data: string[] }
  | { command: 'installComplete' };

/** Messages the Agent Manager webview sends up to the host. */
export type AgentManagerWebviewMessage =
  | { command: 'getDepartments' }
  | { command: 'getFavorites' }
  | { command: 'toggleFavorite'; data: { agentId: string } }
  | { command: 'install'; data: AgentInstallRequest }
  | { command: 'cancel' };

// ---------------------------------------------------------------------------
// Task Manager panel
// ---------------------------------------------------------------------------

export interface FigmaBridgeDetailView {
  status?: { running?: boolean; connected?: boolean; port?: number; url?: string };
  items?: Array<{
    name?: string;
    id?: string;
    type?: string;
    parentName?: string;
    width?: number;
    height?: number;
  }>;
  receivedAt?: string;
  fileName?: string;
  fileKey?: string;
  pageName?: string;
  contextPath?: string;
}

interface TaskMarkdownResult {
  state: TaskManagerState;
  markdown?: { content?: string; updatedAt?: string; lastReadAt?: string };
}

/** Messages the host sends down to the Task Manager webview. */
export type TaskManagerHostMessage =
  | { command: 'taskManagerState'; data: TaskManagerState }
  | { command: 'taskModelCatalog'; data: { availableModels: ModelOption[] } }
  | { command: 'taskModeChanged'; data: { mode: TaskManagerMode } }
  | { command: 'taskItemCreateComplete'; data: { state: TaskManagerState; item: TaskManagerItem } }
  | { command: 'taskItemCreateFailed'; data: { message: string } }
  | { command: 'taskItemSelectComplete'; data: { state: TaskManagerState; item: TaskManagerItem } }
  | { command: 'taskItemSelectFailed'; data: { message: string } }
  | { command: 'taskItemDeleteComplete'; data: { state: TaskManagerState } }
  | { command: 'taskItemDeleteFailed'; data: { message: string } }
  | { command: 'taskDocumentUploadComplete'; data: { state: TaskManagerState; document: TaskDocument } }
  | { command: 'taskDocumentUploadFailed'; data: { message: string } }
  | { command: 'figmaBridgeDetail'; data: FigmaBridgeDetailView }
  | { command: 'figmaBridgeDetailFailed'; data: { message: string } }
  | { command: 'taskMarkdownLoaded'; data: TaskMarkdownResult }
  | { command: 'taskMarkdownUpdated'; data: TaskMarkdownResult }
  | { command: 'taskMarkdownFailed'; data: { message: string } }
  | { command: 'taskMarkdownRunStarted'; data: { state: TaskManagerState; markdownPath: string; message: string } }
  | { command: 'taskMarkdownRunStopped'; data: { markdownPath?: string; message?: string } }
  | { command: 'taskMarkdownRunFailed'; data: { message: string } }
  | { command: 'taskWorkflowRunPrepared'; data: { state: TaskManagerState; workflow: WorkflowFile } }
  | { command: 'taskWorkflowStatusChanged'; data: { blockId: string; status: WorkflowStatus } }
  | { command: 'taskWorkflowRunMessage'; data: { message: string } }
  | { command: 'taskWorkflowRunComplete'; data: { state: TaskManagerState; workflow: WorkflowFile } }
  | {
      command: 'taskWorkflowRunFailed';
      data: { message: string; blockId?: string; state?: TaskManagerState; workflow?: WorkflowFile };
    }
  | { command: 'taskWorkflowStepDoneComplete'; data: { state: TaskManagerState; workflow?: WorkflowFile; message?: string } }
  | { command: 'taskWorkflowStepDoneFailed'; data: { message: string } }
  | { command: 'jiraOpenComplete'; data: { state: TaskManagerState; connection: TaskJiraConnection } }
  | { command: 'jiraOpenFailed'; data: { message: string } }
  | { command: 'jiraReadComplete'; data: { state: TaskManagerState; connection: TaskJiraConnection } }
  | { command: 'jiraReadFailed'; data: { message: string } };

/** Messages the Task Manager webview sends up to the host. */
export type TaskManagerWebviewMessage =
  | { command: 'getTaskManagerState'; data: { mode?: TaskManagerMode; itemId?: string; itemType?: TaskItemType } }
  | { command: 'setTaskMode'; data: { mode: TaskManagerMode } }
  | { command: 'createTaskItem'; data: { id?: string; name?: string; type: TaskItemType; workflowId?: string } }
  | { command: 'selectTaskItem'; data: { id: string; type: TaskItemType } }
  | { command: 'deleteTaskItem'; data: { id: string; type: TaskItemType } }
  | {
      command: 'uploadTaskDocument';
      data: { fileName: string; contentBase64: string; mode?: TaskManagerMode; itemId?: string; itemType?: TaskItemType };
    }
  | { command: 'getFigmaBridgeDetail' }
  | { command: 'startFigmaMcpBridge' }
  | { command: 'showFigmaMcpBridgeStatus' }
  | { command: 'stopFigmaMcpBridge' }
  | { command: 'openFigmaDesktop'; data?: { fileKey?: string } }
  | { command: 'getTaskMarkdown'; data: TaskContext & { regenerate?: boolean } }
  | { command: 'updateTaskMarkdown'; data: TaskContext & { content: string } }
  | { command: 'runTaskMarkdown'; data: TaskContext & { content: string } }
  | { command: 'runTaskWorkflow'; data: TaskContext & { jiraLink?: string } }
  | { command: 'markWorkflowStepDone'; data: TaskContext & { stepId?: string; locator?: unknown } }
  | { command: 'setWorkflowStepModel'; data: TaskContext & { stepId: string; model: string; speed?: string } }
  | { command: 'setWorkflowStepSpeed'; data: TaskContext & { stepId: string; speed: string } }
  | { command: 'openJiraInChrome'; data: TaskContext & { link: string } }
  | { command: 'readJiraTicket'; data: TaskContext & { link: string } }
  | { command: 'openTaskDocument'; data: { workspacePath: string } }
  | { command: 'cancel' };

export interface TaskContext {
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}
