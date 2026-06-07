import { EventRecord, MemoryRecord, generateId } from './MemoryTypes';
import { PrivacyFilter } from './PrivacyFilter';

export class MemorySummarizer {
  private filter = new PrivacyFilter();

  summarizeEvents(events: EventRecord[]): MemoryRecord[] {
    const memories: MemoryRecord[] = [];

    for (const event of events.filter(e => e.type === 'decision')) {
      const title = String(event.data['title'] || 'Technical decision');
      const summary = String(event.data['summary'] || '');
      if (summary) {
        const rawTags = event.data['tags'];
        const tags = Array.isArray(rawTags) ? rawTags.map(String) : ['decision'];
        memories.push(this.createDecisionMemory(title, summary, tags));
      }
    }

    const errorMessages = events
      .filter(e => e.type === 'error')
      .map(e => String(e.data['message'] || ''))
      .filter(Boolean)
      .slice(0, 3);

    if (errorMessages.length) {
      memories.push({
        id: generateId('mem'),
        type: 'memory',
        title: 'Errors encountered in session',
        summary: this.filter.filterText(errorMessages.join('; ')),
        tags: ['error', 'session'],
        createdAt: new Date().toISOString()
      });
    }

    return memories;
  }

  createDecisionMemory(title: string, summary: string, tags?: string[]): MemoryRecord {
    return {
      id: generateId('dec'),
      type: 'decision',
      title: this.filter.filterText(title),
      summary: this.filter.filterText(summary),
      tags: tags ?? ['decision'],
      createdAt: new Date().toISOString()
    };
  }

  createManualMemory(title: string, summary: string, tags: string[]): MemoryRecord {
    return {
      id: generateId('mem'),
      type: 'memory',
      title: this.filter.filterText(title),
      summary: this.filter.filterText(summary),
      tags,
      createdAt: new Date().toISOString()
    };
  }
}
