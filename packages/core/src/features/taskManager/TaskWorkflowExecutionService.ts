import { TaskManagerService } from '../../services/TaskManagerService';
import { WorkflowRunError, WorkflowRunner } from '../workflows/WorkflowRunner';
import type { WorkflowFile, WorkflowStepBlock, WorkflowStatus } from '../workflows/types';
import type { TaskManagerState, TaskWorkflowRunRequest } from '../../models/TaskManager';
import { logger } from '../../utils/logger';

interface TaskWorkflowExecutionContext {
  request: TaskWorkflowRunRequest;
}

export interface TaskWorkflowExecutionEvents {
  onPrepared?: (data: { workflow: WorkflowFile; state: TaskManagerState }) => void;
  onState?: (state: TaskManagerState) => void;
  onStatus?: (blockId: string, status: WorkflowStatus) => void;
  onMessage?: (message: string) => void;
}

export type TaskWorkflowExecutionResult =
  | {
      outcome: 'already-running';
      message: string;
    }
  | {
      outcome: 'completed';
      data: { workflow: WorkflowFile; state: TaskManagerState };
    }
  | {
      outcome: 'failed';
      message: string;
      blockId?: string;
      state?: TaskManagerState;
      workflow?: WorkflowFile;
      error: Error;
    };

export class TaskWorkflowExecutionService {
  private isRunning = false;

  constructor(
    private readonly taskManagerService: TaskManagerService,
    private readonly events: TaskWorkflowExecutionEvents = {},
    private readonly workflowRunner = new WorkflowRunner()
  ) {}

  async run(request: TaskWorkflowRunRequest): Promise<TaskWorkflowExecutionResult> {
    if (this.isRunning) {
      return {
        outcome: 'already-running',
        message: 'A workflow run is already in progress.'
      };
    }

    let workflow: WorkflowFile | undefined;
    this.isRunning = true;

    try {
      const loaded = await this.taskManagerService.getTaskWorkflowForRun(request);
      workflow = loaded.workflow;
      this.events.onState?.(loaded.state);
      this.events.onPrepared?.({ workflow, state: loaded.state });

      await this.workflowRunner.run<TaskWorkflowExecutionContext>(workflow, {
        context: { request },
        executor: {
          execute: async (step, context) => this.executeTaskWorkflowStep(step, context.request)
        },
        preserveSuccessfulStep: step => step.stepType === 'review_human',
        onStatus: (blockId, status) => this.events.onStatus?.(blockId, status),
        onMessage: message => this.events.onMessage?.(message)
      });

      const saved = await this.taskManagerService.saveTaskWorkflow(request, workflow);
      this.events.onState?.(saved.state);
      return {
        outcome: 'completed',
        data: saved
      };
    } catch (error) {
      const caughtError = error as Error;
      let savedState: Awaited<ReturnType<TaskManagerService['saveTaskWorkflow']>> | undefined;

      if (workflow) {
        try {
          savedState = await this.taskManagerService.saveTaskWorkflow(request, workflow);
          this.events.onState?.(savedState.state);
        } catch (saveError) {
          logger.warn(`Unable to save failed workflow state: ${(saveError as Error).message}`);
          // Keep the original workflow failure as the primary error.
        }
      }

      return {
        outcome: 'failed',
        message: caughtError.message,
        blockId: caughtError instanceof WorkflowRunError ? caughtError.blockId : undefined,
        state: savedState?.state,
        workflow: savedState?.workflow,
        error: caughtError
      };
    } finally {
      this.isRunning = false;
    }
  }

  dispose(): void {
    this.workflowRunner.dispose();
  }

  private async executeTaskWorkflowStep(
    step: WorkflowStepBlock,
    request: TaskWorkflowRunRequest
  ): Promise<{ status?: 'success' | 'skipped'; message?: string }> {
    switch (step.stepType) {
      case 'collect_document':
        return this.executeCollectDocumentStep(request);
      case 'collect_figma':
        return this.executeCollectFigmaStep();
      case 'collect_jira':
        return this.executeCollectJiraStep(request);
      case 'review_human':
        return this.executeReviewHumanStep();
      default:
        return this.executeUnsupportedWorkflowStep(step);
    }
  }

  private async executeCollectDocumentStep(
    request: TaskWorkflowRunRequest
  ): Promise<{ status: 'success'; message: string }> {
    const result = await this.taskManagerService.judgeTaskDocumentsWithClaude(request);
    return {
      status: 'success',
      message: result.message || 'Document judgment passed.'
    };
  }

  private async executeCollectFigmaStep(): Promise<{ status: 'success'; message: string }> {
    return {
      status: 'success',
      message: 'Figma design marked completed.'
    };
  }

  private async executeCollectJiraStep(
    request: TaskWorkflowRunRequest
  ): Promise<{ status: 'success'; message: string }> {
    const result = await this.taskManagerService.readJiraTicket({
      ...request,
      link: String(request.jiraLink || '').trim()
    });
    this.events.onState?.(result.state);
    return {
      status: 'success',
      message: `Jira ticket collected: ${result.connection.ticket?.title || result.connection.link}`
    };
  }

  private async executeReviewHumanStep(): Promise<never> {
    throw new Error('Review by Human must be marked done manually before the workflow can continue.');
  }

  private async executeUnsupportedWorkflowStep(
    step: WorkflowStepBlock
  ): Promise<{ status: 'skipped'; message: string }> {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
}
