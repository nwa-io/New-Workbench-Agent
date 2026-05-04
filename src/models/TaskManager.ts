export type TaskManagerMode = 'task' | 'fix-bug';

export type TaskNodeId = 'document' | 'figma' | 'jira' | 'code' | 'testcase';

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

export interface TaskFigmaConnection {
  link: string;
  fileKey: string;
  nodeId?: string;
  fileName: string;
  nodeName?: string;
  lastSyncedAt: string;
  nodes: TaskFigmaNode[];
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
  summary?: string;
  status?: string;
  content: string;
  lastReadAt: string;
}

export interface TaskManagerState {
  mode: TaskManagerMode;
  documentsFolder: string;
  documents: TaskDocument[];
  nodes: TaskProcessNode[];
  figma?: TaskFigmaConnection;
  jira?: TaskJiraConnection;
}

export interface TaskDocumentUpload {
  fileName: string;
  contentBase64: string;
  mode?: TaskManagerMode;
}

export interface TaskFigmaSyncRequest {
  link: string;
  token: string;
  mode?: TaskManagerMode;
}

export interface TaskJiraOpenRequest {
  link: string;
  mode?: TaskManagerMode;
}

export interface TaskJiraReadRequest {
  link: string;
  mode?: TaskManagerMode;
}
