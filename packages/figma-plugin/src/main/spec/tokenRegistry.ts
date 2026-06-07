import type { DesignTokenRef, TokenKind } from "../../shared/types";
import { matchTokenName } from "../matcher/catalog";
import type { BuildCtx } from "./ctx";

export function registerVariableToken(
  v: Variable,
  type: TokenKind,
  ctx: BuildCtx,
  rawValue: unknown
): DesignTokenRef {
  const key = `var:${v.id}`;
  const existing = ctx.tokens.get(key);
  if (existing) {
    existing.usageCount++;
    return existing;
  }
  const match = matchTokenName(v.name, ctx.tokenCatalog);
  const ref: DesignTokenRef = {
    figmaTokenName: v.name,
    figmaVariableId: v.id,
    type,
    value: rawValue,
    codeTokenName: match?.name,
    codeTokenPath: match?.filePath,
    confidence: match?.score,
    usageCount: 1,
  };
  ctx.tokens.set(key, ref);
  return ref;
}

export function registerEffectToken(e: Effect, ctx: BuildCtx): void {
  // Effects styles via styleId would require figma.getStyleByIdAsync; skip
  // the round-trip and key by canonical JSON for dedupe stats.
  const key = `effect:${JSON.stringify(e)}`;
  const existing = ctx.tokens.get(key);
  if (existing) {
    existing.usageCount++;
    return;
  }
  ctx.tokens.set(key, {
    figmaTokenName: `effect/${e.type.toLowerCase()}`,
    type: "shadow",
    value: e,
    usageCount: 1,
  });
}
