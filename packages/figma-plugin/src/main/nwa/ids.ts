import { slugify } from "../../shared/util/slugify";

export function nodeIdFromFigma(name: string, figmaId: string): string {
  const slug = slugify(name) || "node";
  // Take first segment up to ":" or ";" — "8248:51371" → "8248",
  // "I8248:51373;14:76676" → "I8248" → truncated to "I824".
  const head = figmaId.split(/[:;]/)[0];
  const idPart = head.startsWith("I") ? head.slice(0, 4) : head.slice(0, 4);
  return `${slug}-${idPart}`;
}
