import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Auto Commit workflow step (scaffold). No staging/commit is implemented yet, so
 * execution reports a skip. Fill in `execute` to stage and commit changes.
 */
export const autoCommitStep: StepPlugin = {
  stepType: 'auto_commit',
  detailNodeId: 'code',
  label: 'Auto Commit',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
