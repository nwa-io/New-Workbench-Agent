import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Review by AI workflow step (scaffold). The AI review flow is not wired into the
 * package yet, so execution reports a skip. Fill in `execute` (and optionally a
 * `ui` detail script) to review changes with AI using the default skill.
 */
export const reviewAiStep: StepPlugin = {
  stepType: 'review_ai',
  detailNodeId: 'markdown',
  label: 'Review by AI',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
