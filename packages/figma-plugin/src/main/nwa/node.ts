import { PLUGIN_DATA_ICON_NAME } from "../../shared/constants";
import { slugify } from "../../shared/util/slugify";
import { readNodePluginData } from "../storage/nodeData";
import { tryGetMain } from "../scan/walk";
import { extractAutoLayout } from "./autoLayout";
import type { NwaCtx } from "./ctx";
import { maybeExportIcon } from "./icons";
import { nodeIdFromFigma } from "./ids";
import {
  buildInstanceDefinition,
  cleanInstanceProperties,
  collectOverrides,
} from "./instance";
import { findMapping } from "./mappings";
import { getMark } from "../storage/nodeData";
import {
  registerEffectsForNode,
  registerFillsForNode,
  registerStrokesForNode,
} from "./styles";
import { registerTypography } from "./typography";
import { safe } from "./yaml";

export async function buildNwaNode(
  n: SceneNode,
  ctx: NwaCtx,
  inComponentDef: boolean,
  // When true, this is the user-selected root. We never emit it as an
  // INSTANCE_REF wrapper — always expand its full structure.
  isRoot: boolean = false
): Promise<Record<string, unknown>> {
  ctx.nodeCount++;
  const figmaId = n.id;
  const id = nodeIdFromFigma(n.name, figmaId);

  // ---- Auto-export icon-like vector nodes as SVG files. -------------------
  const iconFilename = await maybeExportIcon(n, ctx);
  const isMarkedIcon = getMark(n) === "icon";
  if (isMarkedIcon && iconFilename) {
    return {
      id,
      name: readNodePluginData(n, PLUGIN_DATA_ICON_NAME) || n.name,
      type: n.type,
      figmaId,
      width: safe(() => (n as unknown as { width?: number }).width),
      height: safe(() => (n as unknown as { height?: number }).height),
      filePath: `icons/${iconFilename}`,
    };
  }

  // ---- INSTANCE handling --------------------------------------------------
  if (n.type === "INSTANCE") {
    const mc = await tryGetMain(n as InstanceNode);
    const componentName = mc?.name ?? n.name;
    const componentSlug = slugify(componentName) || "node";

    if (!inComponentDef && !ctx.components.has(figmaId)) {
      const def = await buildInstanceDefinition(
        n as InstanceNode,
        componentSlug,
        ctx,
        buildNwaNode
      );
      ctx.components.set(figmaId, { slug: componentSlug, payload: def });
    }

    const mapping = findMapping(ctx.mappings, componentName, mc?.key, n.id);
    if (mapping) ctx.matchedCount++;

    // In frame.yaml: emit INSTANCE_REF and skip children.
    if (!inComponentDef && !isRoot) {
      const ref: Record<string, unknown> = {
        id,
        name: componentName,
        type: "INSTANCE_REF",
        instanceRef: `@components/${componentSlug}#${id}`,
        width: safe(() => (n as unknown as { width?: number }).width),
        height: safe(() => (n as unknown as { height?: number }).height),
        x: safe(() => n.x),
        y: safe(() => n.y),
      };
      const ov = await collectOverrides(n as InstanceNode);
      if (ov.length) ref.overrides = ov;
      if (mapping) {
        ref.codeComponent = mapping.codeComponent;
        ref.codeFilePath = mapping.codeFilePath;
      }
      if (iconFilename) ref.filePath = `icons/${iconFilename}`;
      return ref;
    }
  }

  // ---- Generic / inline serialization -------------------------------------
  const out: Record<string, unknown> = {
    id,
    name: n.name,
    type: n.type,
    isHidden: !(n as unknown as { visible?: boolean }).visible
      ? !((n as unknown as { visible?: boolean }).visible ?? true)
      : false,
    figmaId,
    width: safe(() => (n as unknown as { width?: number }).width),
    height: safe(() => (n as unknown as { height?: number }).height),
  };
  const x = safe(() => n.x);
  const y = safe(() => n.y);
  if (x !== undefined && x !== 0) out.x = x;
  if (y !== undefined && y !== 0) out.y = y;

  // ---- INSTANCE inside a component def: stay flat, no children expansion --
  if (n.type === "INSTANCE" && inComponentDef) {
    out.componentProperties = cleanInstanceProperties(
      (n as InstanceNode).componentProperties
    );
    if (iconFilename) out.filePath = `icons/${iconFilename}`;
    return out;
  }

  // ---- INSTANCE as the user-selected root: add componentProperties + code -
  if (n.type === "INSTANCE" && isRoot) {
    out.componentProperties = cleanInstanceProperties(
      (n as InstanceNode).componentProperties
    );
    const mc = await tryGetMain(n as InstanceNode);
    const mapping = findMapping(
      ctx.mappings,
      mc?.name ?? n.name,
      mc?.key,
      n.id
    );
    if (mapping) {
      out.codeComponent = mapping.codeComponent;
      out.codeFilePath = mapping.codeFilePath;
    }
    if (iconFilename) out.filePath = `icons/${iconFilename}`;
  }

  // ---- Corner radius -------------------------------------------------------
  const cr = safe(
    () => (n as unknown as { cornerRadius?: number | symbol }).cornerRadius
  );
  if (typeof cr === "number" && cr !== 0) out.cornerRadius = cr;

  // ---- Auto layout ---------------------------------------------------------
  const layout = extractAutoLayout(n);
  if (layout) out.autoLayout = layout;
  const lsh = safe(
    () =>
      (n as unknown as { layoutSizingHorizontal?: string }).layoutSizingHorizontal
  );
  const lsv = safe(
    () =>
      (n as unknown as { layoutSizingVertical?: string }).layoutSizingVertical
  );
  if (lsh) out.layoutSizingHorizontal = lsh;
  if (lsv) out.layoutSizingVertical = lsv;
  const la = safe(() => (n as unknown as { layoutAlign?: string }).layoutAlign);
  if (la && la !== "INHERIT") out.layoutAlign = la;

  // ---- Text content --------------------------------------------------------
  if (n.type === "TEXT") {
    const t = n as TextNode;
    if (typeof t.characters === "string") out.text = t.characters;
    const typoRef = registerTypography(t, n.name, ctx);
    const fillRefs = registerFillsForNode(n, ctx);
    const styleRefs: Record<string, unknown> = {};
    if (fillRefs.length) styleRefs.fills = fillRefs;
    if (typoRef) styleRefs.typography = typoRef;
    if (Object.keys(styleRefs).length) out.styleRefs = styleRefs;
    return out;
  }

  // ---- Style refs ---------------------------------------------------------
  const styleRefs: Record<string, unknown> = {};
  const fillRefs = registerFillsForNode(n, ctx);
  if (fillRefs.length) styleRefs.fills = fillRefs;
  const strokeRefs = registerStrokesForNode(n, ctx);
  if (strokeRefs.length) styleRefs.strokes = strokeRefs;
  const effectRefs = registerEffectsForNode(n, ctx);
  if (effectRefs.length) styleRefs.effects = effectRefs;
  if (Object.keys(styleRefs).length) out.styleRefs = styleRefs;

  // ---- Vector data --------------------------------------------------------
  if (n.type === "VECTOR" && iconFilename) {
    out.filePath = `icons/${iconFilename}`;
    return out;
  }

  // ---- Recurse children ---------------------------------------------------
  if ("children" in n) {
    const kids: Record<string, unknown>[] = [];
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      try {
        kids.push(await buildNwaNode(c, ctx, inComponentDef));
      } catch {
        /* skip un-serializable children */
      }
    }
    if (kids.length) out.children = kids;
  }

  return out;
}
