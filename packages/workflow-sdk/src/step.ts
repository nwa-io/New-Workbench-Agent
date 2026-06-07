import type * as vscode from 'vscode';
import type { WorkflowStepBlock, WorkflowStepType } from './workflow';
import type {
  TaskManagerItem,
  TaskManagerState,
  TaskNodeId,
  TaskWorkflowRunRequest
} from './task';

export interface StepExecutionResult {
  status?: 'success' | 'skipped';
  message?: string;
}

/**
 * Shared runtime surface the core extension exposes to step packages. Implemented
 * by core/task-kernel and consumed only through {@link StepContext}, so a step
 * package never imports core directly. Refined as steps are migrated.
 */
export interface TaskKernel {
  readonly workspaceRoot: string;
  getState(): Promise<TaskManagerState>;
  resolveCurrentItem(): TaskManagerItem | undefined;
  /** Read a file relative to the current task item's folder. */
  readItemFile(relativePath: string): Promise<string | undefined>;
  /** Write a file relative to the current task item's folder. */
  writeItemFile(relativePath: string, content: string): Promise<void>;
}

/**
 * Everything a step needs at execution / message-handling time. Built by core
 * for each run and passed into the step plugin.
 */
export interface StepContext {
  readonly kernel: TaskKernel;
  readonly request: TaskWorkflowRunRequest;
  /** Post a message to the Task Manager webview. */
  post(command: string, data?: unknown): void;
  readonly output: vscode.OutputChannel;
  readonly secrets?: vscode.SecretStorage;
}

/**
 * Props passed to a step's React {@link StepUIContribution.DetailPanel}. The
 * component type is intentionally loose (`unknown` return) so `@nwa/workflow-sdk`
 * stays framework-free — the React webview narrows it where it renders.
 */
export interface StepDetailProps {
  step: WorkflowStepBlock;
  /** Post a webview->host message (the host's fixed command protocol). */
  post: (command: string, data?: unknown) => void;
}

export interface StepUIContribution {
  /**
   * Legacy client-side script concatenated into the string-based Task Manager
   * webview. Superseded by {@link DetailPanel} for the React webview; retained
   * for the coexistence window while step UIs migrate. Because the legacy
   * webview is a single global scope, every global this script declares MUST be
   * namespaced by stepType to avoid collisions with the shell or other steps.
   */
  detailScript?: string;
  /**
   * React detail panel for the migrated Task Manager webview. Typed loosely to
   * keep this package framework-free; the webview supplies the React runtime.
   */
  DetailPanel?: (props: StepDetailProps) => unknown;
  /** Webview->extension command names this step's client code emits. */
  clientCommands?: string[];
}

/**
 * A self-contained workflow step: its backend execution, the webview messages it
 * owns, and the detail UI it contributes. Registered in core's StepRegistry.
 */
export interface StepPlugin {
  readonly stepType: WorkflowStepType;
  readonly detailNodeId: TaskNodeId;
  readonly label: string;
  execute(step: WorkflowStepBlock, ctx: StepContext): Promise<StepExecutionResult | void>;
  /** Server-side handlers for webview messages this step owns. Keyed by command. */
  readonly messageHandlers?: Record<string, (data: unknown, ctx: StepContext) => Promise<void>>;
  readonly ui?: StepUIContribution;
}
