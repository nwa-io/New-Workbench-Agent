import type { StepPlugin } from '@nwa/workflow-sdk';

export { FigmaClient } from './client';
export type { ParsedFigmaLink, FigmaApiResponse, FigmaDocumentNode } from './client';

/**
 * Collect Figma workflow step (node side). Owns the Figma API/node strategy via
 * {@link FigmaClient}, which core delegates to. Its Task Manager detail UI lives
 * in the React-only `./webview` entry (imported by the webview bundle, never the
 * extension build). Workflow execution is UI-driven (bridge + sync), so `execute`
 * is a no-op success.
 */
export const collectFigmaStep: StepPlugin = {
  stepType: 'collect_figma',
  detailNodeId: 'figma',
  label: 'Collect Figma Design',
  async execute() {
    return { status: 'success', message: 'Figma design marked completed.' };
  }
};
