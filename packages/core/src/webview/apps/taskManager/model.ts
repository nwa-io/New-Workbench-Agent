import type {
  TaskManagerMode,
  TaskItemType,
  WorkflowBlock,
  WorkflowStepType
} from '@nwa/workflow-sdk';

export const modeCopy: Record<string, { documentTitle: string; documentCopy: string }> = {
  task: {
    documentTitle: 'Document',
    documentCopy: 'Import SRS, PDF, Office, text, or markdown files for the new task.'
  },
  'fix-bug': {
    documentTitle: 'Bug document',
    documentCopy:
      'Import bug reports, reproduction notes, logs, screenshots converted by markitdown, or related markdown files.'
  },
  analysis: {
    documentTitle: 'Analysis document',
    documentCopy: 'Import research notes, requirements, logs, or source documents for the analysis.'
  }
};

export function modeToItemType(mode: TaskManagerMode): TaskItemType {
  if (mode === 'fix-bug') {
    return 'bug';
  }
  return mode === 'analysis' ? 'analysis' : 'task';
}

export function itemTypeToMode(type: TaskItemType): TaskManagerMode {
  if (type === 'bug' || type === 'task') {
    return 'task';
  }
  return type === 'analysis' ? 'analysis' : 'task';
}

export function itemTypeLabel(type: TaskItemType): string {
  if (type === 'bug') {
    return 'Bug';
  }
  return type === 'analysis' ? 'Analysis' : 'Task';
}

export function itemTypePluralLabel(type: TaskItemType): string {
  return type === 'analysis' ? 'Analysis items' : `${itemTypeLabel(type)}s`;
}

export function itemTypeText(type: TaskItemType): string {
  return itemTypeLabel(type).toLowerCase();
}

export function statusClass(status: string): string {
  return String(status)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

// --- node <-> stepType <-> title mappings ---------------------------------

export function getWorkflowStepTypeForTaskNode(nodeId: string): WorkflowStepType {
  const map: Record<string, WorkflowStepType> = {
    document: 'collect_document',
    figma: 'collect_figma',
    jira: 'collect_jira',
    markdown: 'review_human',
    code: 'code',
    testcase: 'unit_test'
  };
  return map[nodeId] || 'code';
}

export function getDetailNodeIdForWorkflowStep(step: WorkflowBlock | null): string {
  if (!step || step.kind === 'parallel') {
    return 'custom';
  }
  const map: Record<string, string> = {
    collect_document: 'document',
    collect_figma: 'figma',
    collect_jira: 'jira',
    code: 'code',
    review_ai: 'markdown',
    review_human: 'markdown',
    unit_test: 'testcase',
    automation_test: 'testcase',
    testcase: 'testcase',
    auto_commit: 'code'
  };
  return map[step.stepType] || 'custom';
}

export function getWorkflowStepTitle(stepType: string): string {
  const labels: Record<string, string> = {
    collect_document: 'Document',
    collect_figma: 'Figma',
    collect_jira: 'Jira',
    code: 'Code',
    review_ai: 'Review by AI',
    review_human: 'Human review',
    unit_test: 'Unit test',
    automation_test: 'Automation test',
    testcase: 'Test case',
    auto_commit: 'Auto commit'
  };
  return labels[stepType] || 'Workflow step';
}

