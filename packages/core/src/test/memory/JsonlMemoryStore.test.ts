import { resetMockFs } from '../__mocks__/vscode';

// Reset in-memory file store before each test
beforeEach(() => resetMockFs());

describe('JsonlMemoryStore', () => {
  it('appends and reads back a memory record', async () => {
    const { JsonlMemoryStore } = await import('../../features/memory/JsonlMemoryStore');
    const store = new JsonlMemoryStore('/workspace/test');
    await store.initialize();

    await store.appendMemory({
      id: 'mem_001',
      type: 'memory',
      title: 'Test memory',
      summary: 'A summary',
      tags: ['test'],
      createdAt: new Date().toISOString()
    });

    const loaded = await store.loadMemories();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('mem_001');
  });

  it('appends decisions to decisions file', async () => {
    const { JsonlMemoryStore } = await import('../../features/memory/JsonlMemoryStore');
    const store = new JsonlMemoryStore('/workspace/test');
    await store.initialize();

    await store.appendMemory({
      id: 'dec_001',
      type: 'decision',
      title: 'Use YAML',
      summary: 'Workflow files use YAML',
      tags: ['yaml'],
      createdAt: new Date().toISOString()
    });

    const loaded = await store.loadMemories();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].type).toBe('decision');
  });

  it('appends and reads sessions', async () => {
    const { JsonlMemoryStore } = await import('../../features/memory/JsonlMemoryStore');
    const store = new JsonlMemoryStore('/workspace/test');
    await store.initialize();

    await store.appendSession({
      id: 'ses_001',
      startedAt: new Date().toISOString(),
      eventCount: 0
    });

    const sessions = await store.loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('ses_001');
  });

  it('clears memories', async () => {
    const { JsonlMemoryStore } = await import('../../features/memory/JsonlMemoryStore');
    const store = new JsonlMemoryStore('/workspace/test');
    await store.initialize();

    await store.appendMemory({
      id: 'mem_001', type: 'memory', title: 'T', summary: 'S', tags: [],
      createdAt: new Date().toISOString()
    });

    await store.clearMemories();
    const loaded = await store.loadMemories();
    expect(loaded).toHaveLength(0);
  });

  it('deletes a memory by id', async () => {
    const { JsonlMemoryStore } = await import('../../features/memory/JsonlMemoryStore');
    const store = new JsonlMemoryStore('/workspace/test');
    await store.initialize();

    await store.appendMemory({
      id: 'mem_keep', type: 'memory', title: 'Keep', summary: 'Keep this', tags: [],
      createdAt: new Date().toISOString()
    });
    await store.appendMemory({
      id: 'mem_del', type: 'memory', title: 'Delete', summary: 'Remove this', tags: [],
      createdAt: new Date().toISOString()
    });

    await store.deleteMemoryById('mem_del');
    const loaded = await store.loadMemories();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('mem_keep');
  });
});
