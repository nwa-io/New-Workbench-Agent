import { MemoryRecord } from './MemoryTypes';

export class ContextInjector {
  inject(prompt: string, memories: MemoryRecord[]): string {
    if (!memories.length) { return prompt; }
    return `${prompt}\n\n${this.formatBlock(memories)}`;
  }

  formatBlock(memories: MemoryRecord[]): string {
    if (!memories.length) { return ''; }

    const lines: string[] = [
      '## Project Memory Context',
      '',
      'Relevant memories from previous sessions:',
      ''
    ];

    for (const memory of memories) {
      lines.push(`### ${memory.title}`);
      lines.push(`> ${memory.summary}`);
      if (memory.tags.length) {
        lines.push(`*Tags: ${memory.tags.join(', ')}*`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
