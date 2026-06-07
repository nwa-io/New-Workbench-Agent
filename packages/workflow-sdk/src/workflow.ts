import type * as vscode from 'vscode';

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped';

export type WorkflowStepType =
  | 'collect_document'
  | 'collect_figma'
  | 'collect_jira'
  | 'code'
  | 'review_ai'
  | 'review_human'
  | 'unit_test'
  | 'automation_test'
  | 'testcase'
  | 'auto_commit';

export type WorkflowAction =
  | { kind: 'vscodeCommand'; command: string; args?: unknown[] }
  | { kind: 'shell'; command: string; cwd?: string }
  | { kind: 'internal'; name: string; args?: Record<string, unknown> };

export interface WorkflowStepBlock {
  id: string;
  kind: 'step';
  stepType: WorkflowStepType;
  title: string;
  status: WorkflowStatus;
  /** Model id (see {@link MODEL_CATALOG}) the step runs with, e.g. `claude-opus-4-8`. */
  model?: string;
  /** Reasoning/speed level for the model, e.g. `high` (Codex only; see {@link ModelOption.speeds}). */
  modelSpeed?: string;
  config?: Record<string, unknown>;
  actions?: WorkflowAction[];
}

export interface WorkflowParallelBlock {
  id: string;
  kind: 'parallel';
  title: string;
  status: WorkflowStatus;
  children: WorkflowStepBlock[];
}

export type WorkflowBlock = WorkflowStepBlock | WorkflowParallelBlock;

export interface WorkflowFile {
  version: number;
  id: string;
  name: string;
  fileName?: string;
  blocks: WorkflowBlock[];
}

export interface WorkflowRunContext {
  workspaceRoot: string;
  outputChannel: vscode.OutputChannel;
}

export interface StepOption {
  label: string;
  description: string;
  stepType: WorkflowStepType;
}

export const STEP_OPTIONS: StepOption[] = [
  {
    label: 'Collect Document',
    description: 'Collect project documents, markdown, PDF, SRS, requirements',
    stepType: 'collect_document'
  },
  {
    label: 'Collect Figma Design',
    description: 'Collect Figma file/page/node context',
    stepType: 'collect_figma'
  },
  {
    label: 'Collect Jira',
    description: 'Collect Jira ticket, acceptance criteria, comments',
    stepType: 'collect_jira'
  },
  {
    label: 'Code',
    description: 'Use AI to implement the code (main step)',
    stepType: 'code'
  },
  {
    label: 'Review by AI',
    description: 'Review changes with AI using the default skill',
    stepType: 'review_ai'
  },
  {
    label: 'Review by Human',
    description: 'Pause workflow for human review',
    stepType: 'review_human'
  },
  {
    label: 'Unit Test',
    description: 'Run / generate unit tests',
    stepType: 'unit_test'
  },
  {
    label: 'Automation Test',
    description: 'Run end-to-end / automation tests',
    stepType: 'automation_test'
  },
  {
    label: 'Test Case',
    description: 'Use AI to generate manual test cases',
    stepType: 'testcase'
  },
  {
    label: 'Auto Commit',
    description: 'Stage and commit changes',
    stepType: 'auto_commit'
  }
];

export const WORKFLOW_FILE_VERSION = 1;

/**
 * The icon shown for each step type in every workflow tree view (the NWA
 * Workflows builder, Task Manager create preview, and Task Manager detail).
 * Single source of truth — update here to change an icon everywhere.
 */
export const STEP_ICONS: Record<WorkflowStepType, string> = {
  collect_document: '📄',
  collect_figma: '🎨',
  collect_jira: '🧷',
  code: '💻',
  review_ai: '🧠',
  review_human: '👤',
  unit_test: '🧪',
  automation_test: '🤖',
  testcase: '🏁',
  auto_commit: '🚢'
};

/** The icon for a step type, falling back to a neutral dot for unknown types. */
export function stepIcon(stepType: string): string {
  return STEP_ICONS[stepType as WorkflowStepType] || '•';
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

/** The local coding CLI a model is reached through. Mirrors the authenticated CLIs. */
export type ModelProvider = 'claude' | 'codex';



/**
 * The models the workflow builder can assign to a step. A model only appears in
 * the dropdown when its `provider` CLI is authenticated (gated host-side).
 *
 * The Codex CLI has no command that lists models, so its real list is read at
 * runtime from `~/.codex/models_cache.json`; the Codex entries below are only the
 * FALLBACK used when that cache is missing/unreadable. Claude has no equivalent
 * cache, so its entries are the canonical Claude 4.x ids. EDIT HERE to change the
 * static catalog / fallback.
 */
const CODEX_SPEEDS = ['low', 'medium', 'high', 'xhigh'];

export const MODEL_CATALOG: ModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', provider: 'claude' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'claude' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'claude' },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'codex', speeds: CODEX_SPEEDS, defaultSpeed: 'high' },
  { id: 'gpt-5.4', label: 'GPT-5.4', provider: 'codex', speeds: CODEX_SPEEDS, defaultSpeed: 'high' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4-Mini', provider: 'codex', speeds: CODEX_SPEEDS, defaultSpeed: 'high' }
];

/**
 * The best-fit default model per step, by task weight: heavy reasoning for
 * implementation/review, balanced for collection/tests, light for trivial steps.
 * `undefined` means the step runs no model (e.g. the manual Review by Human gate).
 */
export const STEP_MODEL_DEFAULTS: Record<WorkflowStepType, string | undefined> = {
  collect_document: 'claude-sonnet-4-6',
  collect_figma: 'claude-sonnet-4-6',
  collect_jira: 'claude-haiku-4-5',
  code: 'claude-opus-4-8',
  review_ai: 'claude-opus-4-8',
  review_human: undefined,
  unit_test: 'claude-sonnet-4-6',
  automation_test: 'claude-sonnet-4-6',
  testcase: 'claude-sonnet-4-6',
  auto_commit: 'claude-haiku-4-5'
};

export function defaultModelForStep(stepType: WorkflowStepType): string | undefined {
  return STEP_MODEL_DEFAULTS[stepType];
}

/** Catalog filtered to providers the user has authenticated. */
export function modelsForProviders(providers: ModelProvider[]): ModelOption[] {
  return MODEL_CATALOG.filter(model => providers.includes(model.provider));
}

/** The default level for an ascending level list: one below the maximum. */
export function defaultSpeedForLevels(levels: string[]): string | undefined {
  if (levels.length === 0) {
    return undefined;
  }
  if (levels.length === 1) {
    return levels[0];
  }
  return levels[levels.length - 2];
}
