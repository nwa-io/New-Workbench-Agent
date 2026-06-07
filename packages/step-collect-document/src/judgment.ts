/**
 * Collect Document judgment strategy (pure). Owns how imported documents are
 * turned into the Claude judgment prompt and how Claude's report is interpreted.
 * Iterate the prompt/parsing here without touching core; core supplies the
 * already-read document contents and the bundled guide text, and runs Claude.
 */

const DOCUMENT_JUDGMENT_DOCUMENT_LIMIT = 8;
const DOCUMENT_JUDGMENT_DOCUMENT_CHAR_LIMIT = 12000;

export interface JudgmentDocument {
  name: string;
  workspacePath: string;
  content: string;
}

export interface DocumentJudgmentResult {
  ready: boolean;
  message: string;
  statusFound: boolean;
}

function condenseText(value: string, maxLength: number): string {
  const lines = value
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const importantLines = lines.filter((line, index) => {
    return index < 18 ||
      /^#{1,4}\s+/.test(line) ||
      /^[-*]\s+/.test(line) ||
      /^\d+\.\s+/.test(line);
  });
  const condensed = importantLines.join('\n').slice(0, maxLength).trim();

  if (!condensed) {
    return 'No readable text was found.';
  }

  return value.length > maxLength ? `${condensed}\n...` : condensed;
}

export function buildDocumentJudgmentPrompt(
  documents: JudgmentDocument[],
  documentsFolder: string,
  guide: string
): string {
  const documentSections = documents
    .slice(0, DOCUMENT_JUDGMENT_DOCUMENT_LIMIT)
    .map(document => [
      `## ${document.name}`,
      `Path: ${document.workspacePath}`,
      '',
      condenseText(document.content, DOCUMENT_JUDGMENT_DOCUMENT_CHAR_LIMIT)
    ].join('\n'));

  const omittedCount = Math.max(0, documents.length - DOCUMENT_JUDGMENT_DOCUMENT_LIMIT);
  const omittedNotice = omittedCount > 0
    ? `\n\n${omittedCount} additional document(s) exist in ${documentsFolder} but were omitted from this judgment input.`
    : '';

  return [
    'You are judging whether imported task documents are ready for software development.',
    '',
    'Use these rules as the source of truth:',
    guide.trim(),
    '',
    'Return your answer in this exact header format first:',
    'STATUS: READY',
    'MESSAGE: one concise sentence explaining the decision',
    '',
    'or:',
    'STATUS: FAIL',
    'MESSAGE: one concise sentence explaining the blocker',
    '',
    'Use FAIL for conditional, incomplete, ambiguous, conflicting, inaccessible, or non-development-ready documents.',
    'Do not return OK, PASS, BLOCK, CONDITIONAL, PARTIAL, or UNKNOWN.',
    'If you cannot read or inspect the imported documents, return STATUS: FAIL with the reason in MESSAGE.',
    'Do not add any text before the STATUS line.',
    'Do not modify files. Do not implement the task.',
    '',
    `Imported documents folder: ${documentsFolder}`,
    '',
    '# Imported Documents',
    documentSections.join('\n\n'),
    omittedNotice
  ].join('\n').trim();
}

export function parseDocumentJudgmentReport(report: string): DocumentJudgmentResult {
  const status = getDocumentJudgmentStatus(report);
  const message = getDocumentJudgmentMessage(report) ||
    condenseText(report, 600);

  if (status === 'READY') {
    return {
      ready: true,
      message: message || 'Document judgment passed.',
      statusFound: true
    };
  }

  if (status === 'FAIL') {
    return {
      ready: false,
      message: message || 'Imported documents are not ready for development.',
      statusFound: true
    };
  }

  return {
    ready: false,
    message: `Claude document judgment did not return STATUS: READY or STATUS: FAIL. Raw response: ${condenseText(report, 300)}`,
    statusFound: false
  };
}

function getDocumentJudgmentStatus(report: string): 'READY' | 'FAIL' | undefined {
  const statusLineMatch = report.match(/^\s*(?:[-*]\s*)?(?:>\s*)?(?:#+\s*)?(?:\*\*)?STATUS(?:\*\*)?\s*[:=\-]\s*(.+)$/im);
  const jsonStatusMatch = report.match(/["']status["']\s*:\s*["']([^"']+)["']/i);
  const firstLineMatch = report.match(/^\s*(READY|FAIL)\s*$/im);
  const rawStatus = statusLineMatch?.[1] || jsonStatusMatch?.[1] || firstLineMatch?.[1] || '';
  const normalizedStatus = rawStatus
    .replace(/[`*_]/g, '')
    .replace(/[.,;]+$/g, '')
    .trim()
    .toUpperCase();

  if (/^(FAIL|NOT READY|NOT OK|BLOCK|CONDITIONAL)\b/.test(normalizedStatus)) {
    return 'FAIL';
  }

  if (/^READY\b/.test(normalizedStatus) && !/\b(FAIL|BLOCK|CONDITIONAL|NOT READY|NOT OK)\b/.test(normalizedStatus)) {
    return 'READY';
  }

  return undefined;
}

function getDocumentJudgmentMessage(report: string): string {
  return report.match(/^\s*(?:[-*]\s*)?(?:>\s*)?(?:\*\*)?MESSAGE(?:\*\*)?\s*[:=\-]\s*(.+)$/im)?.[1]?.trim() || '';
}
