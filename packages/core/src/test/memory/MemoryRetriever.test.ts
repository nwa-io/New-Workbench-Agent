import { MemoryRetriever } from '../../features/memory/MemoryRetriever';
import { MemoryRecord } from '../../features/memory/MemoryTypes';

const retriever = new MemoryRetriever();

function makeMemory(overrides: Partial<MemoryRecord>): MemoryRecord {
  return {
    id: 'mem_test',
    type: 'memory',
    title: 'Test memory',
    summary: 'A test summary',
    tags: [],
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe('MemoryRetriever.retrieve', () => {
  it('returns empty array when no memories match', () => {
    const memories = [makeMemory({ tags: ['yaml'] })];
    const result = retriever.retrieve(memories, { keywords: ['unrelated-xyz'] });
    expect(result).toHaveLength(0);
  });

  it('returns pinned memories first', () => {
    const pinned = makeMemory({ id: 'pinned', title: 'Pinned', pinned: true, tags: [] });
    const regular = makeMemory({ id: 'regular', title: 'Regular', summary: 'keyword match', tags: [] });
    const result = retriever.retrieve([regular, pinned], { keywords: ['keyword'] });
    expect(result[0].id).toBe('pinned');
  });

  it('prioritizes Jira key matches', () => {
    const jiraMatch = makeMemory({ id: 'jira', title: 'PROJ-123 fix', jiraKeys: ['PROJ-123'] });
    const other = makeMemory({ id: 'other', title: 'other', summary: 'something', tags: ['tag'] });
    const result = retriever.retrieve([other, jiraMatch], { jiraKeys: ['PROJ-123'], keywords: ['something'] });
    expect(result[0].id).toBe('jira');
  });

  it('prioritizes file path matches', () => {
    const fileMatch = makeMemory({ id: 'file', title: 'file match', filePaths: ['src/services/Auth.ts'] });
    const other = makeMemory({ id: 'other', title: 'other thing', summary: 'misc', tags: [] });
    const result = retriever.retrieve([other, fileMatch], {
      filePaths: ['src/services/Auth.ts'],
      keywords: ['misc']
    });
    expect(result[0].id).toBe('file');
  });

  it('matches on keywords in summary', () => {
    const memory = makeMemory({ summary: 'workflow files should use YAML format' });
    const result = retriever.retrieve([memory], { keywords: ['yaml'] });
    expect(result).toHaveLength(1);
  });

  it('matches on tags', () => {
    const memory = makeMemory({ tags: ['architecture', 'yaml'] });
    const result = retriever.retrieve([memory], { keywords: ['yaml'] });
    expect(result).toHaveLength(1);
  });

  it('respects the limit', () => {
    const memories = Array.from({ length: 20 }, (_, i) =>
      makeMemory({ id: `m${i}`, title: `Memory ${i}`, summary: 'keyword present' })
    );
    const result = retriever.retrieve(memories, { keywords: ['keyword'], limit: 5 });
    expect(result).toHaveLength(5);
  });

  it('prioritizes Figma node matches', () => {
    const figmaMatch = makeMemory({ id: 'figma', figmaNodeIds: ['node-abc'] });
    const other = makeMemory({ id: 'other', summary: 'something' });
    const result = retriever.retrieve([other, figmaMatch], { figmaNodeIds: ['node-abc'], keywords: ['something'] });
    expect(result[0].id).toBe('figma');
  });
});
