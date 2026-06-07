import { rgbToHex } from "../../shared/util/colors";
import { bindingForField } from "../tokens/variables";
import type { BuildCtx } from "./ctx";
import { registerEffectToken, registerVariableToken } from "./tokenRegistry";

export async function extractStylesWithTokens(
  n: SceneNode,
  ctx: BuildCtx
): Promise<Record<string, unknown> | undefined> {
  const anyN = n as unknown as {
    fills?: ReadonlyArray<Paint> | symbol;
    strokes?: ReadonlyArray<Paint>;
    strokeWeight?: number | symbol;
    cornerRadius?: number | symbol;
    effects?: ReadonlyArray<Effect>;
    opacity?: number;
    boundVariables?: Record<string, unknown>;
  };

  const hasAny =
    "fills" in n || "strokes" in n || "cornerRadius" in n || "effects" in n;
  if (!hasAny) return undefined;

  const out: Record<string, unknown> = {};

  if (Array.isArray(anyN.fills)) {
    out.fills = (anyN.fills as Paint[]).map((p, i) =>
      paintWithToken(p, n, "fills", i, ctx)
    );
  }
  if (Array.isArray(anyN.strokes)) {
    out.strokes = (anyN.strokes as Paint[]).map((p, i) =>
      paintWithToken(p, n, "strokes", i, ctx)
    );
  }
  if (typeof anyN.strokeWeight === "number") out.strokeWeight = anyN.strokeWeight;
  if (typeof anyN.cornerRadius === "number") {
    out.cornerRadius = cornerRadiusWithToken(
      anyN.cornerRadius,
      n,
      "cornerRadius",
      ctx
    );
  }
  if (Array.isArray(anyN.effects) && anyN.effects.length) {
    out.effects = anyN.effects.map((e) => ({
      kind: e.type,
      raw: e,
    }));
    for (const e of anyN.effects) {
      registerEffectToken(e, ctx);
    }
  }
  if (typeof anyN.opacity === "number" && anyN.opacity !== 1) {
    out.opacity = anyN.opacity;
  }
  return out;
}

function paintWithToken(
  p: Paint,
  node: SceneNode,
  field: string,
  index: number,
  ctx: BuildCtx
): Record<string, unknown> {
  const ref = bindingForField(node, `${field}.${index}`);
  const variable = ref ? ctx.localVars.get(ref) : null;
  if (variable) {
    const tok = registerVariableToken(variable, "color", ctx, p);
    return { tokenRef: tok.figmaTokenName, raw: p };
  }
  if (p.type === "SOLID") {
    return { hex: rgbToHex(p.color, p.opacity ?? 1), raw: p };
  }
  return { raw: p };
}

function cornerRadiusWithToken(
  value: number,
  node: SceneNode,
  field: string,
  ctx: BuildCtx
): unknown {
  const ref = bindingForField(node, field);
  const variable = ref ? ctx.localVars.get(ref) : null;
  if (variable) {
    const tok = registerVariableToken(variable, "radius", ctx, value);
    return { tokenRef: tok.figmaTokenName, raw: value };
  }
  return value;
}
