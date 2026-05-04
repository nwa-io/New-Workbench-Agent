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

export interface TaskManagerState {
  mode: TaskManagerMode;
  documentsFolder: string;
  documents: TaskDocument[];
  nodes: TaskProcessNode[];
}

export interface TaskDocumentUpload {
  fileName: string;
  contentBase64: string;
  mode?: TaskManagerMode;
}
