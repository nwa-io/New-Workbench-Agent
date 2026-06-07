import type { WorkflowFile } from './workflow';

export type TaskManagerMode = 'task' | 'fix-bug' | 'analysis';

export type TaskItemType = 'task' | 'bug' | 'analysis';

export type TaskManagerView = 'list' | 'create' | 'detail';

export type TaskNodeId = 'document' | 'figma' | 'jira' | 'markdown' | 'code' | 'testcase';

export type TaskNodeStatus = 'Unknown' | 'Ready' | 'Missing' | 'Sync' | 'Un-sync';

export interface TaskProcessNode {
  id: TaskNodeId;
  label: string;
  status: TaskNodeStatus;
}

export interface TaskDocument {
  name: string;
  workspacePath: string;
}

export interface TaskItemSummary {
  usageTokens: number;
  progressPercent: number;
  completedFeatureCount: number;
  totalFeatureCount: number;
  currentFeature?: string;
  warning?: string;
  error?: string;
  workflowName?: string;
}

export interface TaskManagerItem {
  id: string;
  type: TaskItemType;
  folderPath: string;
  markdownPath: string;
  jiraPath: string;
  figmaCachePath: string;
  workflowId?: string;
  createdAt?: string;
  updatedAt?: string;
  hasJira: boolean;
  hasMarkdown: boolean;
  hasFigmaCache: boolean;
  summary: TaskItemSummary;
}

export interface TaskFigmaConnection {
  link: string;
  fileKey: string;
  nodeId?: string;
  fileName: string;
  nodeName?: string;
  lastSyncedAt: string;
  nodes: TaskFigmaNode[];
  selectedNodeIds: string[];
}

export interface TaskFigmaNode {
  id: string;
  name: string;
  type: string;
  depth: number;
  path: string;
}

export interface TaskJiraConnection {
  link: string;
  profilePath: string;
  lastOpenedAt?: string;
  lastReadAt?: string;
  ticket?: TaskJiraTicket;
}

export interface TaskJiraTicket {
  url: string;
  title: string;
  key?: string;
  description?: string;
  comments: string[];
  content: string;
  lastReadAt: string;
}

export interface TaskManagerState {
  mode: TaskManagerMode;
  items: TaskManagerItem[];
  currentItem?: TaskManagerItem;
  currentWorkflow?: WorkflowFile;
  projectFolder: string;
  documentsFolder: string;
  sourceDocuments: TaskDocument[];
  documents: TaskDocument[];
  nodes: TaskProcessNode[];
  workflows: WorkflowFile[];
  figma?: TaskFigmaConnection;
  jira?: TaskJiraConnection;
}

export interface TaskMarkdownContent {
  content: string;
  updatedAt?: string;
  generatedAt: string;
}

export interface TaskDocumentUpload {
  fileName: string;
  contentBase64: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskFigmaSyncRequest {
  link: string;
  token: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskFigmaNodeSelectionRequest {
  selectedNodeIds: string[];
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskMarkdownRequest {
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
  regenerate?: boolean;
}

export interface TaskMarkdownUpdateRequest {
  content: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskMarkdownRunRequest {
  content: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskWorkflowRunRequest {
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
  jiraLink?: string;
}

export interface TaskWorkflowStepDoneRequest {
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
  stepId?: string;
  locator?: {
    type?: string;
    index?: number;
    parentIndex?: number;
    childIndex?: number;
  };
}

export interface TaskJiraOpenRequest {
  link: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskJiraReadRequest {
  link: string;
  mode?: TaskManagerMode;
  itemId?: string;
  itemType?: TaskItemType;
}

export interface TaskItemCreateRequest {
  id?: string;
  name?: string;
  type: TaskItemType;
  workflowId?: string;
}

export interface TaskItemSelectRequest {
  id: string;
  type: TaskItemType;
}

export interface TaskItemDeleteRequest {
  id: string;
  type: TaskItemType;
}
