import * as vscode from 'vscode';
import { ErrorRecord, EventRecord, MemoryIndex, MemoryRecord, SessionRecord } from './MemoryTypes';
import { ensureMemoryStructure, getMemoryPaths } from './MemoryPaths';

export class JsonlMemoryStore {
  constructor(private readonly workspaceRoot: string) {}

  private async appendLine(filePath: string, record: unknown): Promise<void> {
    const line = JSON.stringify(record) + '\n';
    const newBytes = Buffer.from(line, 'utf8');
    const uri = vscode.Uri.file(filePath);

    let existing: Uint8Array;
    try {
      existing = await vscode.workspace.fs.readFile(uri);
    } catch {
      existing = new Uint8Array(0);
    }

    const merged = new Uint8Array(existing.length + newBytes.length);
    merged.set(existing);
    merged.set(newBytes, existing.length);
    await vscode.workspace.fs.writeFile(uri, merged);
  }

  private async readLines<T>(filePath: string): Promise<T[]> {
    const uri = vscode.Uri.file(filePath);
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(raw).toString('utf8');
      return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as T);
    } catch {
      return [];
    }
  }

  async appendSession(session: SessionRecord): Promise<void> {
    const paths = getMemoryPaths(this.workspaceRoot);
    await this.appendLine(paths.sessions, session);
  }

  async appendEvent(event: EventRecord): Promise<void> {
    const paths = getMemoryPaths(this.workspaceRoot);
    await this.appendLine(paths.events, event);
  }

  async appendMemory(memory: MemoryRecord): Promise<void> {
    const paths = getMemoryPaths(this.workspaceRoot);
    const file = memory.type === 'decision' ? paths.decisions : paths.memories;
    await this.appendLine(file, memory);
    await this.updateIndex();
  }

  async appendError(error: ErrorRecord): Promise<void> {
    const paths = getMemoryPaths(this.workspaceRoot);
    await this.appendLine(paths.errors, error);
  }

  async loadMemories(): Promise<MemoryRecord[]> {
    const paths = getMemoryPaths(this.workspaceRoot);
    const [memories, decisions] = await Promise.all([
      this.readLines<MemoryRecord>(paths.memories),
      this.readLines<MemoryRecord>(paths.decisions)
    ]);
    return [...memories, ...decisions];
  }

  async loadSessions(): Promise<SessionRecord[]> {
    const paths = getMemoryPaths(this.workspaceRoot);
    return this.readLines<SessionRecord>(paths.sessions);
  }

  async loadEvents(): Promise<EventRecord[]> {
    const paths = getMemoryPaths(this.workspaceRoot);
    return this.readLines<EventRecord>(paths.events);
  }

  async clearMemories(): Promise<void> {
    const paths = getMemoryPaths(this.workspaceRoot);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(paths.memories), new Uint8Array(0));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(paths.decisions), new Uint8Array(0));
    await this.updateIndex();
  }

  async deleteMemoryById(id: string): Promise<boolean> {
    const paths = getMemoryPaths(this.workspaceRoot);
    let deleted = false;

    for (const filePath of [paths.memories, paths.decisions]) {
      const records = await this.readLines<MemoryRecord>(filePath);
      const filtered = records.filter(r => r.id !== id);
      if (filtered.length !== records.length) {
        deleted = true;
        const content =
          filtered.length > 0 ? filtered.map(r => JSON.stringify(r)).join('\n') + '\n' : '';
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(filePath),
          Buffer.from(content, 'utf8')
        );
      }
    }

    if (deleted) {
      await this.updateIndex();
    }
    return deleted;
  }

  async initialize(): Promise<void> {
    await ensureMemoryStructure(this.workspaceRoot);
  }

  private async updateIndex(): Promise<void> {
    const [memories, sessions] = await Promise.all([
      this.loadMemories(),
      this.loadSessions()
    ]);
    const allTags = [...new Set(memories.flatMap(m => m.tags))];
    const index: MemoryIndex = {
      lastUpdated: new Date().toISOString(),
      memoryCount: memories.length,
      sessionCount: sessions.length,
      tags: allTags
    };
    const paths = getMemoryPaths(this.workspaceRoot);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(paths.index),
      Buffer.from(JSON.stringify(index, null, 2), 'utf8')
    );
  }
}
