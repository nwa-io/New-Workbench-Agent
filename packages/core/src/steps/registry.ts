import type {
  StepContext,
  StepPlugin,
  TaskNodeId,
  WorkflowStepType
} from '@nwa/workflow-sdk';
import { STEP_PLUGINS } from './plugins';

export type StepMessageHandler = (data: unknown, ctx: StepContext) => Promise<void>;

/**
 * Indexes the installed {@link StepPlugin}s so core can dispatch workflow
 * execution, webview messages, and UI contributions without knowing about any
 * specific step. Populated from {@link STEP_PLUGINS}.
 */
export class StepRegistry {
  private readonly byType = new Map<WorkflowStepType, StepPlugin>();
  private readonly byNode = new Map<TaskNodeId, StepPlugin>();

  constructor(plugins: StepPlugin[] = STEP_PLUGINS) {
    for (const plugin of plugins) {
      this.byType.set(plugin.stepType, plugin);
      if (!this.byNode.has(plugin.detailNodeId)) {
        this.byNode.set(plugin.detailNodeId, plugin);
      }
    }
  }

  byStepType(stepType: WorkflowStepType): StepPlugin | undefined {
    return this.byType.get(stepType);
  }

  byNodeId(nodeId: TaskNodeId): StepPlugin | undefined {
    return this.byNode.get(nodeId);
  }

  all(): StepPlugin[] {
    return [...this.byType.values()];
  }

  /** Client-side detail scripts contributed by every step, for webview assembly. */
  allDetailScripts(): string[] {
    return this.all()
      .map(plugin => plugin.ui?.detailScript)
      .filter((script): script is string => Boolean(script));
  }

  /** Flattened server-side message handlers, keyed by webview command. */
  allMessageHandlers(): Record<string, StepMessageHandler> {
    const handlers: Record<string, StepMessageHandler> = {};
    for (const plugin of this.all()) {
      if (plugin.messageHandlers) {
        Object.assign(handlers, plugin.messageHandlers);
      }
    }
    return handlers;
  }
}

export const stepRegistry = new StepRegistry();
