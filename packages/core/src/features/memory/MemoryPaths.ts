import * as path from 'path';
import * as vscode from 'vscode';

export const MEMORY_DIR = '.project/memory';
export const MEMORY_CONTEXT_DIR = '.project/memory/context';

export interface MemoryPathSet {
  memoryDir: string;
  contextDir: string;
  sessions: string;
  memories: string;
  events: string;
  decisions: string;
  errors: string;
  index: string;
  projectProfile: string;
  architecture: string;
  codingRules: string;
}

export function getMemoryPaths(workspaceRoot: string): MemoryPathSet {
  const memoryDir = path.join(workspaceRoot, MEMORY_DIR);
  const contextDir = path.join(workspaceRoot, MEMORY_CONTEXT_DIR);
  return {
    memoryDir,
    contextDir,
    sessions: path.join(memoryDir, 'sessions.jsonl'),
    memories: path.join(memoryDir, 'memories.jsonl'),
    events: path.join(memoryDir, 'events.jsonl'),
    decisions: path.join(memoryDir, 'decisions.jsonl'),
    errors: path.join(memoryDir, 'errors.jsonl'),
    index: path.join(memoryDir, 'index.json'),
    projectProfile: path.join(contextDir, 'project-profile.md'),
    architecture: path.join(contextDir, 'architecture.md'),
    codingRules: path.join(contextDir, 'coding-rules.md')
  };
}

export async function ensureMemoryStructure(workspaceRoot: string): Promise<void> {
  const paths = getMemoryPaths(workspaceRoot);
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(paths.memoryDir));
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(paths.contextDir));
}
