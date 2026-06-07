import { ContextInjector } from '../../features/memory/ContextInjector';
import { MemoryRecord } from '../../features/memory/MemoryTypes';

const injector = new ContextInjector();

function makeMemory(title: string, summary: string, tags: string[] = []): MemoryRecord {
  return {
    id: 'mem_1',
    type: 'memory',
    title,
    summary,
    tags,
    createdAt: new Date().toISOString()
  };
}

describe('ContextInjector', () => {
  it('returns empty string when no memories', () => {
    expect(injector.formatBlock([])).toBe('');
  });

  it('formats a memory block with heading', () => {
    const block = injector.formatBlock([makeMemory('Use YAML', 'Workflow files use YAML')]);
    expect(block).toContain('## Project Memory Context');
    expect(block).toContain('Use YAML');
    expect(block).toContain('Workflow files use YAML');
  });

  it('includes tags when present', () => {
    const block = injector.formatBlock([makeMemory('Decision', 'Summary', ['yaml', 'arch'])]);
    expect(block).toContain('yaml, arch');
  });

  it('omits tags line when tags array is empty', () => {
    const block = injector.formatBlock([makeMemory('Title', 'Summary', [])]);
    expect(block).not.toContain('Tags:');
  });

  it('inject appends block to prompt', () => {
    const result = injector.inject('Do the task.', [makeMemory('Decision', 'Use X')]);
    expect(result).toContain('Do the task.');
    expect(result).toContain('## Project Memory Context');
  });

  it('inject returns original prompt when no memories', () => {
    const result = injector.inject('Do the task.', []);
    expect(result).toBe('Do the task.');
  });
});
