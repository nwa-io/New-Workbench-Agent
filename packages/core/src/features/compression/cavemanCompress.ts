// Ported from caveman-shrink/compress.js
// https://github.com/JuliusBrussee/caveman/tree/main/mcp-servers/caveman-shrink
//
// Removes fillers, pleasantries, hedging, articles, and leading phrases from
// prose while leaving code blocks, inline code, URLs, paths, identifiers,
// version numbers, and function-like tokens untouched.

const FILLERS =
  /\b(?:just|really|basically|actually|simply|quite|very|essentially|literally)\b/gi;

const PLEASANTRIES =
  /\b(?:please|kindly|thank you|thanks|sure|certainly|of course|happy to|i'?d be happy)\b[,.]?\s*/gi;

const HEDGES =
  /\b(?:perhaps|maybe|might|could potentially|would like to|i think|in my opinion|it seems|it appears)\b\s*/gi;

const LEADERS =
  /^(?:i'?ll|i will|i can|i'?d|you can|we will|we can|let me|let'?s)\s+/gim;

const ARTICLES = /\b(?:a|an|the)\s+(?=[a-z])/gi;

const PROTECTED_PATTERNS: RegExp[] = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /\bhttps?:\/\/\S+/gi,
  /\b[\w.-]*[\/\\][\w.\/\\\-]+/g,
  /\b[A-Z][A-Za-z0-9]*(?:_[A-Z][A-Za-z0-9]*)+\b/g,
  /\b\w+\.\w+(?:\.\w+)*\(\)?/g,
  /[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)/g,
  /\b\d+\.\d+\.\d+\b/g,
];

export interface CompressionResult {
  compressed: string;
  before: number;
  after: number;
  savedPercent: number;
}

function withProtectedSegments(text: string, transform: (s: string) => string): string {
  const segments: string[] = [];
  let working = text;
  for (const re of PROTECTED_PATTERNS) {
    working = working.replace(re, (m) => {
      const i = segments.length;
      segments.push(m);
      return ` ${i} `;
    });
  }
  let out = transform(working);
  out = out.replace(/ (\d+) /g, (_, i: string) => segments[Number(i)]);
  return out;
}

function compressProse(text: string): string {
  let s = text;
  s = s.replace(LEADERS, '');
  s = s.replace(PLEASANTRIES, '');
  s = s.replace(HEDGES, '');
  s = s.replace(FILLERS, '');
  s = s.replace(ARTICLES, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\s+([,.;:!?])/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
  return s.trim();
}

export function compressAgentText(text: string): CompressionResult {
  if (typeof text !== 'string' || text.length === 0) {
    return { compressed: text ?? '', before: 0, after: 0, savedPercent: 0 };
  }
  const before = text.length;
  const compressed = withProtectedSegments(text, compressProse);
  const after = compressed.length;
  const savedPercent = before > 0 ? ((before - after) / before) * 100 : 0;
  return { compressed, before, after, savedPercent };
}
