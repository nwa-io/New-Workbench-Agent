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
  | 'review_human'
  | 'unit_test'
  | 'automation_test'
  | 'auto_commit'
  | 'custom';

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
    label: 'Auto Commit',
    description: 'Stage and commit changes',
    stepType: 'auto_commit'
  },
  {
    label: 'Custom',
    description: 'Custom step (configure later)',
    stepType: 'custom'
  }
];

export const WORKFLOW_FILE_VERSION = 1;
