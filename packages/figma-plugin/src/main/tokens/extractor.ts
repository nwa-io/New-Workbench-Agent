import type {
  DesignTokenRef,
  FETokenCatalogItem,
  TokenKind,
} from "../../shared/types";
import { matchTokenName } from "../matcher/catalog";
import { bindingForField } from "./variables";

// Collects design tokens used by a single node: bound variables on fills /
// strokes / corner radius, drop-shadow effects, and the node's text style.
// Mutates the shared `tokens` map (deduped by variable id / style name).
export async function collectNodeTokens(
  n: SceneNode,
  tokens: Map<string, DesignTokenRef>,
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>,
  localVars: Map<string, Variable>
): Promise<void> {
  const regVar = (v: Variable, type: TokenKind, rawValue: unknown): void => {
    const key = `var:${v.id}`;
    const existing = tokens.get(key);
    if (existing) {
      existing.usageCount++;
      return;
    }
    const match = matchTokenName(v.name, tokenCatalog);
    tokens.set(key, {
      figmaTokenName: v.name,
      figmaVariableId: v.id,
      type,
      value: rawValue,
      codeTokenName: match?.name,
      codeTokenPath: match?.filePath,
      confidence: match?.score,
      usageCount: 1,
    });
  };

  const anyN = n as unknown as {
    fills?: ReadonlyArray<Paint> | symbol;
    strokes?: ReadonlyArray<Paint>;
    cornerRadius?: number | symbol;
    effects?: ReadonlyArray<Effect>;
  };

  if (Array.isArray(anyN.fills)) {
    (anyN.fills as Paint[]).forEach((p, i) => {
      const ref = bindingForField(n, `fills.${i}`);
      const v = ref ? localVars.get(ref) : null;
      if (v) regVar(v, "color", p);
    });
  }
  if (Array.isArray(anyN.strokes)) {
    (anyN.strokes as Paint[]).forEach((p, i) => {
      const ref = bindingForField(n, `strokes.${i}`);
      const v = ref ? localVars.get(ref) : null;
      if (v) regVar(v, "color", p);
    });
  }
  if (typeof anyN.cornerRadius === "number") {
    const ref = bindingForField(n, "cornerRadius");
    const v = ref ? localVars.get(ref) : null;
    if (v) regVar(v, "radius", anyN.cornerRadius);
  }
  if (Array.isArray(anyN.effects)) {
    for (const e of anyN.effects as Effect[]) {
      const key = `effect:${JSON.stringify(e)}`;
      const existing = tokens.get(key);
      if (existing) {
        existing.usageCount++;
        continue;
      }
      tokens.set(key, {
        figmaTokenName: `effect/${e.type.toLowerCase()}`,
        type: "shadow",
        value: e,
        usageCount: 1,
      });
    }
  }

  if (n.type === "TEXT") {
    try {
      const sid = (n as unknown as { textStyleId?: string | symbol }).textStyleId;
      if (typeof sid === "string" && sid) {
        const style = await figma.getStyleByIdAsync(sid);
        if (style) {
          const key = `typo:${style.name}`;
          const existing = tokens.get(key);
          if (existing) {
            existing.usageCount++;
          } else {
            const match = matchTokenName(style.name, tokenCatalog);
            tokens.set(key, {
              figmaTokenName: style.name,
              figmaStyleId: sid,
              type: "typography",
              value: { name: style.name },
              codeTokenName: match?.name,
              codeTokenPath: match?.filePath,
              confidence: match?.score,
              usageCount: 1,
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}
