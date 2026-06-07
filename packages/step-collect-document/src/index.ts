import type { StepPlugin } from '@nwa/workflow-sdk';
import { documentDetailScript } from './ui';

export {
  buildDocumentJudgmentPrompt,
  parseDocumentJudgmentReport
} from './judgment';
export type { JudgmentDocument, DocumentJudgmentResult } from './judgment';

/**
 * Collect Document workflow step. Currently contributes its detail UI through the
 * registry. The backend (markitdown conversion + Claude document judgment) stays
 * in core until the task kernel exposes the item-folder, bundled-guide, and
 * terminal primitives it needs; at that point `execute` becomes live.
 */
export const collectDocumentStep: StepPlugin = {
  stepType: 'collect_document',
  detailNodeId: 'document',
  label: 'Collect Document',
  ui: {
    detailScript: documentDetailScript
  },
  async execute() {
    // Still handled by core's executor (document judgment needs kernel primitives
    // not yet exposed). Throwing keeps accidental early routing loud.
    throw new Error('collect_document step execution is not yet routed through the registry.');
  }
};
