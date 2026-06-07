import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Review by Human workflow step (scaffold). This step pauses the workflow: it
 * must be marked done manually before the run can continue, so automated
 * execution throws. The runner preserves a successful review across re-runs.
 */
export const reviewHumanStep: StepPlugin = {
  stepType: 'review_human',
  detailNodeId: 'markdown',
  label: 'Review by Human',
  async execute() {
    throw new Error('Review by Human must be marked done manually before the workflow can continue.');
  }
};
