import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Unit Test workflow step (scaffold). No unit test running is implemented yet, so
 * execution reports a skip. Fill in `execute` (and optionally a `ui` detail
 * script) to build out unit test running / generation.
 */
export const unitTestStep: StepPlugin = {
  stepType: 'unit_test',
  detailNodeId: 'testcase',
  label: 'Unit Test',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
