import { EventRecord, MemoryRecord, SessionRecord, generateId } from './MemoryTypes';
import { JsonlMemoryStore } from './JsonlMemoryStore';
import { MemoryRetriever, RetrievalQuery } from './MemoryRetriever';
import { MemorySummarizer } from './MemorySummarizer';
import { ContextInjector } from './ContextInjector';
import { PrivacyFilter } from './PrivacyFilter';

export class MemoryService {
  private readonly store: JsonlMemoryStore;
  private readonly retriever = new MemoryRetriever();
  private readonly summarizer = new MemorySummarizer();
  private readonly injector = new ContextInjector();
  private readonly filter = new PrivacyFilter();

  private currentSessionId?: string;
  private currentSessionEvents: EventRecord[] = [];

  constructor(private readonly workspaceRoot: string) {
    this.store = new JsonlMemoryStore(workspaceRoot);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  async startSession(prompt?: string, taskId?: string): Promise<string> {
    const sessionId = generateId('ses');
    this.currentSessionId = sessionId;
    this.currentSessionEvents = [];

    const session: SessionRecord = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      prompt: prompt ? this.filter.filterText(prompt) : undefined,
      taskId,
      eventCount: 0
    };

    await this.store.appendSession(session);
    return sessionId;
  }

  async recordEvent(type: EventRecord['type'], data: Record<string, unknown>): Promise<void> {
    if (!this.currentSessionId) { return; }

    const event: EventRecord = {
      id: generateId('evt'),
      sessionId: this.currentSessionId,
      type,
      data: this.filter.filterObject(data),
      createdAt: new Date().toISOString()
    };

    this.currentSessionEvents.push(event);
    await this.store.appendEvent(event);
  }

  async recordDecision(title: string, summary: string, tags?: string[]): Promise<void> {
    await this.recordEvent('decision', { title, summary, tags });
    const memory = this.summarizer.createDecisionMemory(title, summary, tags);
    await this.store.appendMemory(memory);
  }

  async recordError(message: string, context?: string): Promise<void> {
    await this.recordEvent('error', { message, context });
  }

  async completeSession(): Promise<MemoryRecord[]> {
    if (!this.currentSessionId) { return []; }

    const newMemories = this.summarizer.summarizeEvents(this.currentSessionEvents);
    for (const memory of newMemories) {
      await this.store.appendMemory(memory);
    }

    this.currentSessionId = undefined;
    this.currentSessionEvents = [];
    return newMemories;
  }

  async addManualMemory(title: string, summary: string, tags: string[]): Promise<MemoryRecord> {
    const memory = this.summarizer.createManualMemory(title, summary, tags);
    await this.store.appendMemory(memory);
    return memory;
  }

  async searchMemories(query: RetrievalQuery): Promise<MemoryRecord[]> {
    const all = await this.store.loadMemories();
    return this.retriever.retrieve(all, query);
  }

  async getRelevantContext(query: RetrievalQuery): Promise<string> {
    const memories = await this.searchMemories({ ...query, limit: 5 });
    if (!memories.length) { return ''; }
    return this.injector.formatBlock(memories);
  }

  async injectIntoPrompt(prompt: string, query: RetrievalQuery): Promise<string> {
    const memories = await this.searchMemories({ ...query, limit: 5 });
    return this.injector.inject(prompt, memories);
  }

  async loadAllMemories(): Promise<MemoryRecord[]> {
    return this.store.loadMemories();
  }

  async clearAllMemories(): Promise<void> {
    await this.store.clearMemories();
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.store.deleteMemoryById(id);
  }

  get currentSession(): string | undefined {
    return this.currentSessionId;
  }
}
