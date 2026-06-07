import type { StepPlugin } from '@nwa/workflow-sdk';

/**
 * Test Case workflow step (scaffold). Manual test-case generation is not wired
 * into the package yet, so execution reports a skip. Fill in `execute` (and
 * optionally a `ui` detail script) to generate manual test cases with AI.
 */
export const testcaseStep: StepPlugin = {
  stepType: 'testcase',
  detailNodeId: 'testcase',
  label: 'Test Case',
  async execute(step) {
    return {
      status: 'skipped',
      message: `Step "${step.title}" is not automated yet, so it was skipped.`
    };
  }
};
