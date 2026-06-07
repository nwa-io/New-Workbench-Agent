import type {
  TaskDocument,
  TaskFigmaConnection,
  TaskFigmaNode,
  TaskItemType,
  TaskJiraTicket,
  TaskManagerItem,
  TaskManagerMode
} from '@nwa/workflow-sdk';

/**
 * Spec/markdown brief generation strategy (pure). Given the bundled guide text
 * and the already-gathered context (document summaries, selected Figma nodes,
 * Jira ticket), fills the guide into the task markdown brief. Iterate the
 * template/formatting here without touching core; core gathers the inputs, reads
 * the guide, appends memory context, and writes the file.
 */

export interface SpecMarkdownInputs {
  mode: TaskManagerMode;
  item: TaskManagerItem;
  documentSummaries: Array<{ document: TaskDocument; summary: string }>;
  documentsFolder: string;
  figmaConnection?: TaskFigmaConnection;
  figmaNodes: TaskFigmaNode[];
  ticket?: TaskJiraTicket;
}

export function buildSpecMarkdown(guide: string, inputs: SpecMarkdownInputs): string {
  const { mode, item, documentSummaries, documentsFolder, figmaConnection, figmaNodes, ticket } = inputs;

  const objective = item.type === 'bug' || mode === 'fix-bug'
    ? '- Use this condensed context to diagnose and fix the bug in the codebase.'
    : mode === 'analysis'
      ? '- Use this condensed context to analyze the codebase, requirements, and implementation options.'
      : '- Use this condensed context to implement the task in the codebase.';
  const content = guide
    .replace(/\r/g, '')
    .replace('- Use this condensed context to implement the task in the codebase.', objective)
    .replace('[Listing all file imported in here]', formatTaskMarkdownDocumentItems(documentSummaries, documentsFolder))
    .replace('[Listing all Figma file node selected in here]', formatTaskMarkdownFigmaItems(figmaConnection, figmaNodes))
    .replace('[Listing Jira content (title, description, comments) in here]', formatTaskMarkdownJiraItems(ticket))
    .trim();

  return [
    `Task item: ${getTaskItemTypeLabel(item.type)} ${item.id}`,
    `Item folder: ${item.folderPath}`,
    `Markdown cache: ${item.markdownPath}`,
    '',
    content
  ].join('\n');
}

export function formatTaskMarkdownDocumentItems(
  documentSummaries: Array<{ document: TaskDocument; summary: string }>,
  documentsFolder: string
): string {
  if (documentSummaries.length === 0) {
    return `No imported markdown documents were found in ${documentsFolder}.`;
  }

  return documentSummaries.map(({ document, summary }, index) => [
    `${index + 1}. ${document.name}`,
    `   - Path: ${document.workspacePath}`,
    `   - Condensed content: ${summary.replace(/\n/g, '\n     ')}`
  ].join('\n')).join('\n\n');
}

export function formatTaskMarkdownFigmaItems(
  figmaConnection: TaskFigmaConnection | undefined,
  nodes: TaskFigmaNode[]
): string {
  if (!figmaConnection) {
    return 'No Figma file is synced.';
  }

  if (nodes.length === 0) {
    return [
      `File: ${figmaConnection.fileName}`,
      'No Figma nodes are selected for this item.'
    ].join('\n');
  }

  return [
    `File: ${figmaConnection.fileName}`,
    ...nodes.map((node, index) => [
      `${index + 1}. ${node.name}`,
      `   - Type: ${node.type}`,
      `   - Node ID: ${node.id}`,
      `   - Path: ${node.path}`
    ].join('\n'))
  ].join('\n');
}

export function formatTaskMarkdownJiraItems(ticket?: TaskJiraTicket): string {
  if (!ticket) {
    return 'No Jira ticket has been read yet.';
  }

  return [
    '### Ticket',
    ticket.key ? `- Key: ${ticket.key}` : undefined,
    `- URL: ${ticket.url}`,
    `- Read: ${ticket.lastReadAt}`,
    '',
    '### Title',
    ticket.title,
    '',
    '### Description',
    ticket.description || 'No description collected.',
    '',
    '### Comments',
    formatJiraCommentMarkdown(ticket.comments, 4)
  ].filter((line): line is string => line !== undefined).join('\n');
}

function getTaskItemTypeLabel(type: TaskItemType): string {
  if (type === 'bug') {
    return 'Bug';
  }

  return type === 'analysis' ? 'Analysis' : 'Task';
}

function formatJiraCommentMarkdown(comments: string[], headingLevel: number): string {
  const normalizedComments = comments
    .map(comment => comment.trim())
    .filter(Boolean);

  if (normalizedComments.length === 0) {
    return 'No comments collected.';
  }

  const heading = '#'.repeat(headingLevel);
  return normalizedComments
    .map((comment, index) => [`${heading} Comment ${index + 1}`, comment].join('\n'))
    .join('\n\n');
}
