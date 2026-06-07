import { MemoryRecord } from './MemoryTypes';

export interface RetrievalQuery {
  keywords?: string[];
  filePaths?: string[];
  jiraKeys?: string[];
  figmaNodeIds?: string[];
  limit?: number;
}

export class MemoryRetriever {
  retrieve(memories: MemoryRecord[], query: RetrievalQuery): MemoryRecord[] {
    const limit = query.limit ?? 10;

    return memories
      .map(memory => ({ memory, score: this.score(memory, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory }) => memory);
  }

  private score(memory: MemoryRecord, query: RetrievalQuery): number {
    let score = 0;

    if (memory.pinned) {
      score += 100;
    }

    if (query.jiraKeys?.length) {
      const hit = query.jiraKeys.some(
        key =>
          memory.jiraKeys?.includes(key) ||
          memory.summary.includes(key) ||
          memory.title.includes(key)
      );
      if (hit) { score += 60; }
    }

    if (query.figmaNodeIds?.length) {
      const hit = query.figmaNodeIds.some(id => memory.figmaNodeIds?.includes(id));
      if (hit) { score += 60; }
    }

    if (query.filePaths?.length) {
      const hit = query.filePaths.some(fp =>
        memory.filePaths?.some(mfp => mfp.includes(fp) || fp.includes(mfp))
      );
      if (hit) { score += 40; }
    }

    if (query.keywords?.length) {
      for (const keyword of query.keywords) {
        const kw = keyword.toLowerCase();
        if (memory.tags.some(tag => tag.toLowerCase().includes(kw))) {
          score += 20;
        }
        score += this.keywordScore(kw, memory.title, memory.summary);
      }
    }

    if (score > 0) {
      score += this.recencyBoost(memory.createdAt);
    }

    return score;
  }

  private keywordScore(keyword: string, title: string, summary: string): number {
    const titleLower = title.toLowerCase();
    const summaryLower = summary.toLowerCase();

    if (titleLower.includes(keyword)) { return 10; }
    if (summaryLower.includes(keyword)) { return 5; }

    const words = keyword.split(/\s+/).filter(Boolean);
    const matchCount = words.filter(w => summaryLower.includes(w)).length;
    return Math.min(matchCount, 5);
  }

  private recencyBoost(createdAt: string): number {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const days = ageMs / (1000 * 60 * 60 * 24);
    if (days < 1) { return 10; }
    if (days < 7) { return 5; }
    if (days < 30) { return 2; }
    return 0;
  }
}
