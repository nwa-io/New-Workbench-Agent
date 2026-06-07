import { stableJson } from "../../shared/util/stableJson";
import type { NwaCtx } from "./ctx";
import { nodeIdFromFigma } from "./ids";
import { effectToProps, paintToProps } from "./paints";

export function registerFillsForNode(n: SceneNode, ctx: NwaCtx): string[] {
  const anyN = n as unknown as { fills?: ReadonlyArray<Paint> | symbol };
  if (!Array.isArray(anyN.fills)) return [];
  const refs: string[] = [];
  for (const paint of anyN.fills as Paint[]) {
    if (paint.visible === false) continue;
    const props = paintToProps(paint);
    const sig = stableJson(props);
    const idBase = `fill-${nodeIdFromFigma(n.name, n.id)}`;
    const entry = ensureStyle(ctx.fills, sig, idBase, n.name, "fill", props);
    refs.push(`@styles/fills#${entry.id}`);
  }
  return refs;
}

export function registerStrokesForNode(n: SceneNode, ctx: NwaCtx): string[] {
  const anyN = n as unknown as { strokes?: ReadonlyArray<Paint> };
  if (!Array.isArray(anyN.strokes)) return [];
  const refs: string[] = [];
  for (const paint of anyN.strokes as Paint[]) {
    if (paint.visible === false) continue;
    const props = paintToProps(paint);
    const sig = stableJson(props);
    const idBase = `stroke-${nodeIdFromFigma(n.name, n.id)}`;
    const entry = ensureStyle(ctx.strokes, sig, idBase, n.name, "stroke", props);
    refs.push(`@styles/strokes#${entry.id}`);
  }
  return refs;
}

export function registerEffectsForNode(n: SceneNode, ctx: NwaCtx): string[] {
  const anyN = n as unknown as { effects?: ReadonlyArray<Effect> };
  if (!Array.isArray(anyN.effects)) return [];
  const refs: string[] = [];
  for (const e of anyN.effects as Effect[]) {
    if (e.visible === false) continue;
    const props = effectToProps(e);
    const sig = stableJson(props);
    const idBase = `effect-${nodeIdFromFigma(n.name, n.id)}`;
    const entry = ensureStyle(ctx.effects, sig, idBase, n.name, "effect", props);
    refs.push(`@styles/effects#${entry.id}`);
  }
  return refs;
}

export function ensureStyle(
  map: Map<string, { id: string; entry: Record<string, unknown> }>,
  sig: string,
  idBase: string,
  name: string,
  type: string,
  properties: Record<string, unknown>
): { id: string; entry: Record<string, unknown> } {
  const existing = map.get(sig);
  if (existing) return existing;
  const entry = {
    id: idBase,
    name,
    type,
    properties,
  };
  const wrap = { id: idBase, entry };
  map.set(sig, wrap);
  return wrap;
}
