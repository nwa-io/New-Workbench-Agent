import { getMemoryPaths, MEMORY_DIR, MEMORY_CONTEXT_DIR } from '../../features/memory/MemoryPaths';
import * as path from 'path';

describe('getMemoryPaths', () => {
  const root = '/workspace/project';

  it('returns memoryDir under .project/memory', () => {
    const paths = getMemoryPaths(root);
    expect(paths.memoryDir).toBe(path.join(root, MEMORY_DIR));
  });

  it('returns contextDir under .project/memory/context', () => {
    const paths = getMemoryPaths(root);
    expect(paths.contextDir).toBe(path.join(root, MEMORY_CONTEXT_DIR));
  });

  it('sessions file is inside memoryDir', () => {
    const paths = getMemoryPaths(root);
    expect(paths.sessions).toContain('sessions.jsonl');
    expect(paths.sessions.startsWith(paths.memoryDir)).toBe(true);
  });

  it('includes all required files', () => {
    const paths = getMemoryPaths(root);
    expect(paths.memories).toContain('memories.jsonl');
    expect(paths.events).toContain('events.jsonl');
    expect(paths.decisions).toContain('decisions.jsonl');
    expect(paths.errors).toContain('errors.jsonl');
    expect(paths.index).toContain('index.json');
    expect(paths.projectProfile).toContain('project-profile.md');
    expect(paths.architecture).toContain('architecture.md');
    expect(paths.codingRules).toContain('coding-rules.md');
  });
});

describe('ensureMemoryStructure', () => {
  it('creates memory and context directories', async () => {
    const { workspace, resetMockFs } = await import('../__mocks__/vscode');
    resetMockFs();

    const { ensureMemoryStructure } = await import('../../features/memory/MemoryPaths');
    await ensureMemoryStructure('/workspace/test');

    expect(workspace.fs.createDirectory).toHaveBeenCalledTimes(2);
  });
});
