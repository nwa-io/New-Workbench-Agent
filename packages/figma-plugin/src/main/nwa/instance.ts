import { tryGetMain } from "../scan/walk";
import { extractAutoLayout } from "./autoLayout";
import type { NwaCtx } from "./ctx";
import { nodeIdFromFigma } from "./ids";
import { findMapping } from "./mappings";
import {
  registerEffectsForNode,
  registerFillsForNode,
  registerStrokesForNode,
} from "./styles";

export function cleanInstanceProperties(
  cp: ComponentProperties | undefined
): Record<string, unknown> {
  if (!cp) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cp)) {
    out[k] = {
      value: (v as { value: unknown }).value,
      type: (v as { type: string }).type,
      isOverridden: (v as { boundVariables?: unknown }).boundVariables
        ? false
        : false,
    };
  }
  return out;
}

export async function collectOverrides(n: InstanceNode): Promise<
  Array<{ property: string; value: unknown; type: string }>
> {
  const cp = n.componentProperties;
  if (!cp) return [];
  const out: Array<{ property: string; value: unknown; type: string }> = [];
  for (const [k, v] of Object.entries(cp)) {
    out.push({
      property: stripPropSuffix(k),
      value: (v as { value: unknown }).value,
      type: (v as { type: string }).type,
    });
  }
  return out;
}

function stripPropSuffix(s: string): string {
  // Figma property names look like "Color#3281:2103"; strip the "#…" tail.
  const i = s.indexOf("#");
  return i === -1 ? s : s.slice(0, i);
}

export async function buildInstanceDefinition(
  n: InstanceNode,
  _slug: string,
  ctx: NwaCtx,
  buildChild: (
    c: SceneNode,
    ctx: NwaCtx,
    inComponentDef: boolean
  ) => Promise<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const id = nodeIdFromFigma(n.name, n.id);
  const def: Record<string, unknown> = {
    id,
    name: n.name,
    type: "INSTANCE",
    isHidden: !n.visible,
    figmaId: n.id,
    componentProperties: cleanInstanceProperties(n.componentProperties),
    width: n.width,
    height: n.height,
  };
  if (n.x) def.x = n.x;
  if (n.y) def.y = n.y;
  const cr = (n as unknown as { cornerRadius?: number | symbol }).cornerRadius;
  if (typeof cr === "number" && cr !== 0) def.cornerRadius = cr;

  const layout = extractAutoLayout(n);
  if (layout) def.autoLayout = layout;
  if (n.layoutSizingHorizontal)
    def.layoutSizingHorizontal = n.layoutSizingHorizontal;
  if (n.layoutSizingVertical) def.layoutSizingVertical = n.layoutSizingVertical;

  const styleRefs: Record<string, unknown> = {};
  const fillRefs = registerFillsForNode(n, ctx);
  if (fillRefs.length) styleRefs.fills = fillRefs;
  const strokeRefs = registerStrokesForNode(n, ctx);
  if (strokeRefs.length) styleRefs.strokes = strokeRefs;
  const effectRefs = registerEffectsForNode(n, ctx);
  if (effectRefs.length) styleRefs.effects = effectRefs;
  if (Object.keys(styleRefs).length) def.styleRefs = styleRefs;

  const mc = await tryGetMain(n);
  const mapping = findMapping(ctx.mappings, mc?.name ?? n.name, mc?.key, n.id);
  if (mapping) {
    def.codeFilePath = mapping.codeFilePath;
    def.codeComponent = mapping.codeComponent;
    ctx.matchedCount++;
  }

  const kids: Record<string, unknown>[] = [];
  for (const c of n.children) {
    kids.push(await buildChild(c, ctx, /*inComponentDef*/ true));
  }
  if (kids.length) def.children = kids;

  return def;
}
