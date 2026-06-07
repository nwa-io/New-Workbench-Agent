import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Code workflow step (scaffold). The AI implementation flow is not wired into the
 * package yet, so execution reports a skip. Fill in `execute` (and optionally a
 * `ui` detail script) to drive the main AI code-implementation step.
 */
export const codeStep: StepPlugin = {
  stepType: 'code',
  detailNodeId: 'code',
  label: 'Code',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
