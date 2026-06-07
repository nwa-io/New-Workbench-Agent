import { resetMockFs } from '../__mocks__/vscode';

beforeEach(() => resetMockFs());

describe('MemoryService', () => {
  it('can start and complete a session', async () => {
    const { MemoryService } = await import('../../features/memory/MemoryService');
    const service = new MemoryService('/workspace/test');
    await service.initialize();

    const sessionId = await service.startSession('Implement login flow', 'task_001');
    expect(sessionId).toMatch(/^ses_/);
    expect(service.currentSession).toBe(sessionId);

    const memories = await service.completeSession();
    expect(service.currentSession).toBeUndefined();
    expect(Array.isArray(memories)).toBe(true);
  });

  it('adds a manual memory', async () => {
    const { MemoryService } = await import('../../features/memory/MemoryService');
    const service = new MemoryService('/workspace/test');
    await service.initialize();

    const memory = await service.addManualMemory(
      'Use TypeScript strict mode',
      'All new files should enable strict mode in tsconfig',
      ['typescript', 'config']
    );

    expect(memory.id).toMatch(/^mem_/);
    expect(memory.title).toBe('Use TypeScript strict mode');

    const all = await service.loadAllMemories();
    expect(all).toHaveLength(1);
  });

  it('records a decision and stores it immediately', async () => {
    const { MemoryService } = await import('../../features/memory/MemoryService');
    const service = new MemoryService('/workspace/test');
    await service.initialize();
    await service.startSession();

    await service.recordDecision(
      'Prefer YAML for workflows',
      'All workflow files should use .yaml extension',
      ['workflow', 'yaml']
    );

    const all = await service.loadAllMemories();
    expect(all.some(m => m.type === 'decision')).toBe(true);
  });

  it('clears all memories', async () => {
    const { MemoryService } = await import('../../features/memory/MemoryService');
    const service = new MemoryService('/workspace/test');
    await service.initialize();

    await service.addManualMemory('Memory 1', 'Summary 1', ['tag']);
    await service.addManualMemory('Memory 2', 'Summary 2', ['tag']);

    await service.clearAllMemories();
    const all = await service.loadAllMemories();
    expect(all).toHaveLength(0);
  });

  it('searchMemories returns relevant results', async () => {
    const { MemoryService } = await import('../../features/memory/MemoryService');
    const service = new MemoryService('/workspace/test');
    await service.initialize();

    await service.addManualMemory('YAML workflow format', 'Use YAML not JSON for workflows', ['yaml']);
    await service.addManualMemory('Auth pattern', 'Use JWT for auth tokens', ['auth']);

    const results = await service.searchMemories({ keywords: ['yaml'] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('YAML');
  });
});
