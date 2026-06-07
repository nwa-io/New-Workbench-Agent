export type MemoryType = 'memory' | 'decision';

export type MemoryEventType = 'prompt' | 'tool' | 'decision' | 'error' | 'file-read' | 'file-edit';

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  title: string;
  summary: string;
  tags: string[];
  createdAt: string;
  pinned?: boolean;
  filePaths?: string[];
  jiraKeys?: string[];
  figmaNodeIds?: string[];
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  prompt?: string;
  taskId?: string;
  eventCount: number;
}

export interface EventRecord {
  id: string;
  sessionId: string;
  type: MemoryEventType;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ErrorRecord {
  id: string;
  sessionId?: string;
  message: string;
  context?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface MemoryIndex {
  lastUpdated: string;
  memoryCount: number;
  sessionCount: number;
  tags: string[];
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
