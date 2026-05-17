import * as vscode from 'vscode';
import { WorkflowBlock, WorkflowFile, WorkflowParallelBlock, WorkflowStepBlock, WorkflowStatus } from './types';

export type StatusListener = (blockId: string, status: WorkflowStatus, block: WorkflowBlock) => void;

export interface WorkflowStepExecutionResult {
  status?: Extract<WorkflowStatus, 'success' | 'skipped'>;
  message?: string;
}

export interface WorkflowStepExecutor<TContext = WorkflowRunContext> {
  execute(step: WorkflowStepBlock, context: TContext): Promise<WorkflowStepExecutionResult | void>;
}

export interface WorkflowRunContext {
  outputChannel: vscode.OutputChannel;
}

export interface WorkflowRunnerOptions<TContext = WorkflowRunContext> {
  context: TContext;
  executor: WorkflowStepExecutor<TContext>;
  onStatus: StatusListener;
  onMessage?: (message: string) => void;
  preserveSuccessfulStep?: (step: WorkflowStepBlock, context: TContext) => boolean;
}

export class WorkflowRunError extends Error {
  readonly blockId?: string;

  constructor(message: string, blockId?: string, cause?: unknown) {
    super(message);
    this.name = 'WorkflowRunError';
    this.blockId = blockId;

    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class WorkflowRunner {
  private output: vscode.OutputChannel;

  constructor(output?: vscode.OutputChannel) {
    this.output = output ?? vscode.window.createOutputChannel('NWA Workflow');
  }

  async run<TContext = WorkflowRunContext>(
    workflow: WorkflowFile,
    optionsOrListener: WorkflowRunnerOptions<TContext> | StatusListener
  ): Promise<WorkflowFile> {
    const options = this.normalizeOptions(optionsOrListener);
    this.output.show(true);
    this.output.appendLine(`Running workflow "${workflow.name}" (${workflow.blocks.length} blocks)`);

    this.resetStatuses(workflow, options);

    for (const block of workflow.blocks) {
      await this.runBlock(block, options);
    }

    this.output.appendLine(`Workflow "${workflow.name}" finished`);
    return workflow;
  }

  private normalizeOptions<TContext>(
    optionsOrListener: WorkflowRunnerOptions<TContext> | StatusListener
  ): WorkflowRunnerOptions<TContext> {
    if (typeof optionsOrListener === 'function') {
      return {
        context: { outputChannel: this.output } as TContext,
        executor: {
          execute: async () => {
            await this.sleep(300);
            return { status: 'success' };
          }
        },
        onStatus: optionsOrListener
      };
    }

    return optionsOrListener;
  }

  private resetStatuses<TContext>(
    workflow: WorkflowFile,
    options: WorkflowRunnerOptions<TContext>
  ): void {
    for (const block of workflow.blocks) {
      this.resetBlockStatus(block, options);
    }
  }

  private resetBlockStatus<TContext>(
    block: WorkflowBlock,
    options: WorkflowRunnerOptions<TContext>
  ): WorkflowStatus {
    if (block.kind === 'step') {
      const preserved = block.status === 'success' && this.shouldPreserveSuccessfulStep(block, options);
      const nextStatus = preserved ? 'success' : 'idle';
      this.setStatus(block, nextStatus, options.onStatus);
      return nextStatus;
    }

    const childStatuses = block.children.map(child => this.resetBlockStatus(child, options));
    const nextStatus = childStatuses.length > 0 && childStatuses.every(status => status === 'success' || status === 'skipped')
      ? 'success'
      : 'idle';
    this.setStatus(block, nextStatus, options.onStatus);
    return nextStatus;
  }

  private async runBlock<TContext>(
    block: WorkflowBlock,
    options: WorkflowRunnerOptions<TContext>
  ): Promise<void> {
    if (block.kind === 'step') {
      await this.runStep(block, options);
      return;
    }

    await this.runParallel(block, options);
  }

  private async runStep<TContext>(
    step: WorkflowStepBlock,
    options: WorkflowRunnerOptions<TContext>
  ): Promise<void> {
    if (step.status === 'success' && this.shouldPreserveSuccessfulStep(step, options)) {
      this.emitMessage(options, `Skipped completed step "${step.title}".`);
      this.setStatus(step, 'success', options.onStatus);
      return;
    }

    this.setStatus(step, 'running', options.onStatus);
    this.output.appendLine(`  step [${step.stepType}] ${step.title}`);

    try {
      const result = await options.executor.execute(step, options.context);
      const finalStatus = result?.status || 'success';
      this.setStatus(step, finalStatus, options.onStatus);

      if (result?.message) {
        this.emitMessage(options, result.message);
      }
    } catch (error) {
      this.setStatus(step, 'failed', options.onStatus);
      const message = (error as Error).message || `Workflow step "${step.title}" failed.`;
      throw new WorkflowRunError(message, step.id, error);
    }
  }

  private async runParallel<TContext>(
    group: WorkflowParallelBlock,
    options: WorkflowRunnerOptions<TContext>
  ): Promise<void> {
    this.setStatus(group, 'running', options.onStatus);
    this.output.appendLine(`  parallel: ${group.title} (${group.children.length} children)`);

    if (group.children.length === 0) {
      this.setStatus(group, 'success', options.onStatus);
      return;
    }

    const results = await Promise.allSettled(group.children.map(child => this.runStep(child, options)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failed) {
      this.setStatus(group, 'failed', options.onStatus);
      const reason = failed.reason as Error;
      throw reason instanceof WorkflowRunError
        ? reason
        : new WorkflowRunError(reason.message || `Parallel group "${group.title}" failed.`, group.id, reason);
    }

    this.setStatus(group, 'success', options.onStatus);
  }

  private setStatus(block: WorkflowBlock, status: WorkflowStatus, onStatus: StatusListener): void {
    block.status = status;

    if (block.id) {
      onStatus(block.id, status, block);
    }
  }

  private shouldPreserveSuccessfulStep<TContext>(
    step: WorkflowStepBlock,
    options: WorkflowRunnerOptions<TContext>
  ): boolean {
    return Boolean(options.preserveSuccessfulStep?.(step, options.context));
  }

  private emitMessage<TContext>(options: WorkflowRunnerOptions<TContext>, message: string): void {
    if (message) {
      options.onMessage?.(message);
      this.output.appendLine(`  ${message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.output.dispose();
  }
}
