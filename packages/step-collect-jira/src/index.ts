import type { StepPlugin } from '@nwa/workflow-sdk';
import { jiraDetailScript } from './ui';

export { JiraScraper } from './scraper';

/**
 * Collect Jira workflow step. Currently contributes its detail UI through the
 * registry; backend execution and message handlers are migrated off the core
 * monolith in a follow-up increment, at which point `execute` becomes live.
 */
export const collectJiraStep: StepPlugin = {
  stepType: 'collect_jira',
  detailNodeId: 'jira',
  label: 'Collect Jira',
  ui: {
    detailScript: jiraDetailScript
  },
  async execute() {
    // Not yet wired into core's executor (still handled by the core dispatcher).
    // Throwing keeps an accidental early invocation loud rather than silent.
    throw new Error('collect_jira step execution is not yet routed through the registry.');
  }
};
