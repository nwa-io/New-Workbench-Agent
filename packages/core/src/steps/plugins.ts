import type { StepPlugin } from '@nwa/workflow-sdk';
import { collectJiraStep } from '@nwa/step-collect-jira';
import { collectFigmaStep } from '@nwa/step-collect-figma';
import { collectDocumentStep } from '@nwa/step-collect-document';
import { codeStep } from '@nwa/step-code';
import { reviewAiStep } from '@nwa/step-review-ai';
import { testcaseStep } from '@nwa/step-testcase';
import { automationTestStep } from '@nwa/step-automation-test';
import { unitTestStep } from '@nwa/step-unit-test';
import { autoCommitStep } from '@nwa/step-auto-commit';
import { reviewHumanStep } from '@nwa/step-review-human';

/**
 * The set of workflow step packages bundled into the extension. Step packages are
 * added here with a STATIC import so esbuild includes them in the bundle.
 */
export const STEP_PLUGINS: StepPlugin[] = [
  collectJiraStep,
  collectFigmaStep,
  collectDocumentStep,
  codeStep,
  reviewAiStep,
  testcaseStep,
  automationTestStep,
  unitTestStep,
  autoCommitStep,
  reviewHumanStep
];
