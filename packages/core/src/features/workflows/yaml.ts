import {
  WORKFLOW_FILE_VERSION,
  WorkflowBlock,
  WorkflowFile,
  WorkflowParallelBlock,
  WorkflowStatus,
  WorkflowStepBlock,
  WorkflowStepType,
  defaultModelForStep
} from './types';

const INDENT = '  ';
const VALID_STATUS: WorkflowStatus[] = ['idle', 'running', 'success', 'failed', 'skipped'];

function quote(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function unquote(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function emitStep(b: WorkflowStepBlock, baseIndent: string, dashIndent: string): string {
  const lines: string[] = [];
  lines.push(`${dashIndent}- id: ${quote(b.id)}`);
  lines.push(`${baseIndent}kind: "step"`);
  lines.push(`${baseIndent}stepType: ${quote(b.stepType)}`);
  lines.push(`${baseIndent}title: ${quote(b.title)}`);
  lines.push(`${baseIndent}status: ${quote(b.status)}`);
  const model = b.model ?? defaultModelForStep(b.stepType);
  if (model) {
    lines.push(`${baseIndent}model: ${quote(model)}`);
  }
  if (b.modelSpeed) {
    lines.push(`${baseIndent}modelSpeed: ${quote(b.modelSpeed)}`);
  }
  return lines.join('\n');
}

function emitParallel(b: WorkflowParallelBlock, baseIndent: string, dashIndent: string): string {
  const lines: string[] = [];
  lines.push(`${dashIndent}- id: ${quote(b.id)}`);
  lines.push(`${baseIndent}kind: "parallel"`);
  lines.push(`${baseIndent}title: ${quote(b.title)}`);
  lines.push(`${baseIndent}status: ${quote(b.status)}`);
  if (b.children.length === 0) {
    lines.push(`${baseIndent}children: []`);
  } else {
    lines.push(`${baseIndent}children:`);
    const childDash = baseIndent + INDENT;
    const childBase = childDash + INDENT;
    for (const c of b.children) {
      lines.push(emitStep(c, childBase, childDash));
    }
  }
  return lines.join('\n');
}

export function stringifyWorkflow(wf: WorkflowFile): string {
  const lines: string[] = [];
  lines.push(`version: ${wf.version}`);
  lines.push(`id: ${quote(wf.id)}`);
  lines.push(`name: ${quote(wf.name)}`);
  if (wf.blocks.length === 0) {
    lines.push(`blocks: []`);
  } else {
    lines.push(`blocks:`);
    const dashIndent = INDENT;
    const baseIndent = INDENT + INDENT;
    for (const b of wf.blocks) {
      if (b.kind === 'step') {
        lines.push(emitStep(b, baseIndent, dashIndent));
      } else {
        lines.push(emitParallel(b, baseIndent, dashIndent));
      }
    }
  }
  return lines.join('\n') + '\n';
}

function countIndent(s: string): number {
  let i = 0;
  while (i < s.length && s[i] === ' ') {
    i++;
  }
  return i;
}

function parseScalarValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    return unquote(trimmed);
  }
  const n = Number(trimmed);
  if (!Number.isNaN(n) && trimmed !== '') {
    return n;
  }
  return trimmed;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asStatus(v: unknown): WorkflowStatus {
  return VALID_STATUS.includes(v as WorkflowStatus) ? (v as WorkflowStatus) : 'idle';
}

function asStepType(v: unknown): WorkflowStepType {
  return typeof v === 'string' ? (v as WorkflowStepType) : 'code';
}

function asModel(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

interface Line {
  indent: number;
  text: string;
  raw: string;
}

function tokenize(src: string): Line[] {
  return src
    .split(/\r?\n/)
    .map(raw => ({ indent: countIndent(raw), text: raw.trim(), raw }))
    .filter(l => l.text.length > 0 && !l.text.startsWith('#'));
}

interface Cursor {
  i: number;
}

function parseMapEntries(lines: Line[], cursor: Cursor, mapIndent: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  while (cursor.i < lines.length) {
    const line = lines[cursor.i];
    if (line.indent < mapIndent) {
      break;
    }
    if (line.indent > mapIndent) {
      cursor.i++;
      continue;
    }
    if (line.text.startsWith('- ')) {
      break;
    }
    const colon = line.text.indexOf(':');
    if (colon === -1) {
      cursor.i++;
      continue;
    }
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    cursor.i++;
    if (rest === '') {
      const next = lines[cursor.i];
      if (next && next.indent > mapIndent && next.text.startsWith('- ')) {
        result[key] = parseList(lines, cursor, next.indent);
      } else if (next && next.indent > mapIndent) {
        result[key] = parseMapEntries(lines, cursor, next.indent);
      } else {
        result[key] = null;
      }
    } else if (rest === '[]') {
      result[key] = [];
    } else if (rest === '{}') {
      result[key] = {};
    } else {
      result[key] = parseScalarValue(rest);
    }
  }
  return result;
}

function parseList(lines: Line[], cursor: Cursor, dashIndent: number): unknown[] {
  const out: unknown[] = [];
  while (cursor.i < lines.length) {
    const line = lines[cursor.i];
    if (line.indent < dashIndent) {
      break;
    }
    if (line.indent > dashIndent || !line.text.startsWith('- ')) {
      cursor.i++;
      continue;
    }
    const inlineAfterDash = line.text.slice(2);
    const childMapIndent = dashIndent + 2;
    const colon = inlineAfterDash.indexOf(':');
    if (colon === -1) {
      out.push(parseScalarValue(inlineAfterDash));
      cursor.i++;
      continue;
    }
    const firstKey = inlineAfterDash.slice(0, colon).trim();
    const firstVal = inlineAfterDash.slice(colon + 1).trim();
    const item: Record<string, unknown> = {};
    if (firstVal === '') {
      cursor.i++;
      const next = lines[cursor.i];
      if (next && next.indent >= childMapIndent && next.text.startsWith('- ')) {
        item[firstKey] = parseList(lines, cursor, next.indent);
      } else if (next && next.indent >= childMapIndent) {
        item[firstKey] = parseMapEntries(lines, cursor, next.indent);
      } else {
        item[firstKey] = null;
      }
    } else if (firstVal === '[]') {
      item[firstKey] = [];
      cursor.i++;
    } else {
      item[firstKey] = parseScalarValue(firstVal);
      cursor.i++;
    }
    const tail = parseMapEntries(lines, cursor, childMapIndent);
    Object.assign(item, tail);
    out.push(item);
  }
  return out;
}

function blockFromRaw(raw: Record<string, unknown>): WorkflowBlock | null {
  const kind = asString(raw.kind);
  if (kind === 'parallel') {
    const childrenRaw = Array.isArray(raw.children) ? raw.children : [];
    const children: WorkflowStepBlock[] = [];
    for (const c of childrenRaw) {
      if (typeof c === 'object' && c !== null) {
        const m = c as Record<string, unknown>;
        children.push({
          id: asString(m.id),
          kind: 'step',
          stepType: asStepType(m.stepType),
          title: asString(m.title),
          status: asStatus(m.status),
          model: asModel(m.model),
          modelSpeed: asModel(m.modelSpeed)
        });
      }
    }
    return {
      id: asString(raw.id),
      kind: 'parallel',
      title: asString(raw.title),
      status: asStatus(raw.status),
      children
    };
  }
  if (kind === 'step') {
    return {
      id: asString(raw.id),
      kind: 'step',
      stepType: asStepType(raw.stepType),
      title: asString(raw.title),
      status: asStatus(raw.status),
      model: asModel(raw.model),
      modelSpeed: asModel(raw.modelSpeed)
    };
  }
  return null;
}

export function parseWorkflow(src: string): WorkflowFile {
  const lines = tokenize(src);
  const cursor: Cursor = { i: 0 };
  const root = parseMapEntries(lines, cursor, 0);
  const blocksRaw = Array.isArray(root.blocks) ? root.blocks : [];
  const blocks: WorkflowBlock[] = [];
  for (const b of blocksRaw) {
    if (typeof b === 'object' && b !== null) {
      const blk = blockFromRaw(b as Record<string, unknown>);
      if (blk) {
        blocks.push(blk);
      }
    }
  }
  return {
    version: typeof root.version === 'number' ? root.version : WORKFLOW_FILE_VERSION,
    id: asString(root.id),
    name: asString(root.name, 'Untitled'),
    blocks
  };
}
