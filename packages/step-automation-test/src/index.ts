import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Automation Test workflow step (scaffold). No automation is implemented yet, so
 * execution reports a skip. Fill in `execute` (and optionally a `ui` detail
 * script) to build out end-to-end / automation test running.
 */
export const automationTestStep: StepPlugin = {
  stepType: 'automation_test',
  detailNodeId: 'testcase',
  label: 'Automation Test',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
