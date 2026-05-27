// spex.ts — SpeX export bundle builder.
//
// Converts a Figma selection into the multi-file SpeX format documented at
// https://makespek.vercel.app/docs/features/export-design-specs/.
//
// Output structure:
//
//   <root>/
//   ├── manifest.yaml             # version + exportDate + files[]
//   ├── README.md                 # format docs
//   ├── frame.yaml                # full hierarchy with refs (INSTANCE_REF, styleRefs)
//   ├── components/<slug>.yaml    # one file per unique component (deduped)
//   ├── styles/
//   │   ├── fills.yaml
//   │   ├── strokes.yaml
//   │   ├── effects.yaml
//   │   └── typography.yaml
//   ├── icons/ic_<slug>_<id>.svg  # raw SVG for icon-like nodes
//   ├── images/                   # PNG image fills (.placeholder when empty)
//   └── previews/section.png      # 2× PNG render of the root
//
// All nodes use stable, slug-based ids derived from `name + figmaId` so the
// frame can reference shared definitions deterministically.

import yaml from "js-yaml";
import type { ComponentMapping } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SpexFile =
  | { kind: "text"; content: string }
  | { kind: "binary"; base64: string };

export interface SpexBundle {
  rootSlug: string;
  manifest: {
    version: string;
    exportDate: string;
    files: string[];
  };
  files: Record<string, SpexFile>;
  stats: {
    nodes: number;
    uniqueComponents: number;
    fills: number;
    strokes: number;
    effects: number;
    typography: number;
    icons: number;
    matchedComponents: number;
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const SPEX_VERSION = "1.0";
const ICON_MAX = 80;
const ICON_NAME_RE =
  /(^|[\/_\-\s])(icon|close|check|checkmark|chevron|chevron-up|chevron-down|chevron-left|chevron-right|arrow|arrow-up|arrow-down|arrow-left|arrow-right|plus|minus|search|menu|dots|more|x|x-close|chevron-selector-vertical)([\/_\-\s]|$)/i;

interface Ctx {
  mappings: ReadonlyArray<ComponentMapping>;

  // Style catalogues keyed by canonical signature; emit ids when first seen.
  fills: Map<string, { id: string; entry: Record<string, unknown> }>;
  strokes: Map<string, { id: string; entry: Record<string, unknown> }>;
  effects: Map<string, { id: string; entry: Record<string, unknown> }>;
  typography: Map<string, { id: string; entry: Record<string, unknown> }>;

  // Unique component definitions keyed by figmaId (sharable).
  components: Map<string, { slug: string; payload: Record<string, unknown> }>;

  // Icon SVG bytes, keyed by filename.
  icons: Map<string, Uint8Array>;

  // Avoid duplicating icon exports for the same node.
  iconNodeIds: Set<string>;

  // Stats.
  nodeCount: number;
  matchedCount: number;
}

export async function buildSpexBundle(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>
): Promise<SpexBundle> {
  const ctx: Ctx = {
    mappings,
    fills: new Map(),
    strokes: new Map(),
    effects: new Map(),
    typography: new Map(),
    components: new Map(),
    icons: new Map(),
    iconNodeIds: new Set(),
    nodeCount: 0,
    matchedCount: 0,
  };

  const frameNode = await buildNode(
    root,
    ctx,
    /*inComponentDef*/ false,
    /*isRoot*/ true
  );

  const files: Record<string, SpexFile> = {};
  const fileList: string[] = [];

  // ---- frame.yaml ---------------------------------------------------------
  files["frame.yaml"] = textFile(dumpYaml([frameNode]));
  fileList.push("frame.yaml");

  // ---- components/*.yaml --------------------------------------------------
  const componentEntries = Array.from(ctx.components.entries()).sort((a, b) =>
    a[1].slug.localeCompare(b[1].slug)
  );
  for (const [, comp] of componentEntries) {
    const path = `components/${comp.slug}.yaml`;
    files[path] = textFile(dumpYaml([comp.payload]));
    fileList.push(path);
  }

  // ---- styles/*.yaml ------------------------------------------------------
  files["styles/fills.yaml"] = textFile(
    dumpYaml(Array.from(ctx.fills.values()).map((v) => v.entry))
  );
  files["styles/strokes.yaml"] = textFile(
    dumpYaml(Array.from(ctx.strokes.values()).map((v) => v.entry))
  );
  files["styles/effects.yaml"] = textFile(
    dumpYaml(Array.from(ctx.effects.values()).map((v) => v.entry))
  );
  files["styles/typography.yaml"] = textFile(
    dumpYaml(Array.from(ctx.typography.values()).map((v) => v.entry))
  );
  fileList.push(
    "styles/fills.yaml",
    "styles/strokes.yaml",
    "styles/effects.yaml",
    "styles/typography.yaml"
  );

  // ---- icons/*.svg --------------------------------------------------------
  const iconPaths = Array.from(ctx.icons.keys()).sort();
  for (const filename of iconPaths) {
    const path = `icons/${filename}`;
    const bytes = ctx.icons.get(filename)!;
    files[path] = textFile(decodeUtf8(bytes));
    fileList.push(path);
  }

  // ---- images/ ------------------------------------------------------------
  // Reserved for IMAGE-paint exports; placeholder to keep the folder around.
  files["images/.placeholder"] = textFile("");
  fileList.push("images/.placeholder");

  // ---- previews/section.png ----------------------------------------------
  try {
    const preview = await (root as unknown as ExportMixin).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    files["previews/section.png"] = binaryFile(uint8ToBase64(preview));
    fileList.push("previews/section.png");
  } catch {
    /* ignore */
  }

  // ---- manifest.yaml + README.md ------------------------------------------
  const exportDate = new Date().toISOString();
  const manifest = {
    version: SPEX_VERSION,
    exportDate,
    files: ["frame.yaml", ...fileList.filter((f) => f !== "frame.yaml")],
  };
  files["manifest.yaml"] = textFile(dumpYaml(manifest));
  files["README.md"] = textFile(README(manifest, ctx));

  const rootSlug = slugify(root.name) || "design";

  return {
    rootSlug,
    manifest,
    files,
    stats: {
      nodes: ctx.nodeCount,
      uniqueComponents: ctx.components.size,
      fills: ctx.fills.size,
      strokes: ctx.strokes.size,
      effects: ctx.effects.size,
      typography: ctx.typography.size,
      icons: ctx.icons.size,
      matchedComponents: ctx.matchedCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Node walker
// ---------------------------------------------------------------------------

async function buildNode(
  n: SceneNode,
  ctx: Ctx,
  inComponentDef: boolean,
  // When true, this is the user-selected root. We never emit it as an
  // INSTANCE_REF wrapper -- always expand its full structure so the user
  // sees the content of what they selected.
  isRoot: boolean = false
): Promise<Record<string, unknown>> {
  ctx.nodeCount++;
  const figmaId = n.id;
  const id = nodeIdFromFigma(n.name, figmaId);

  // ---- Auto-export icon-like vector nodes as SVG files. -------------------
  // (Exported regardless of where they appear; reference is via `filePath`.)
  const iconFilename = await maybeExportIcon(n, ctx);

  // ---- INSTANCE handling --------------------------------------------------
  if (n.type === "INSTANCE") {
    const mc = await tryGetMain(n as InstanceNode);
    const componentName = mc?.name ?? n.name;
    const componentSlug = slugify(componentName);

    // Save the full instance definition under components/<slug>.yaml once
    // (only when we encounter it outside another component definition).
    if (!inComponentDef && !ctx.components.has(figmaId)) {
      const def = await buildInstanceDefinition(
        n as InstanceNode,
        componentSlug,
        ctx
      );
      ctx.components.set(figmaId, { slug: componentSlug, payload: def });
    }

    // Match against user mappings for codeFilePath / codeComponent enrichment.
    const mapping = findMapping(ctx.mappings, componentName, mc?.key, n.id);
    if (mapping) ctx.matchedCount++;

    // In frame.yaml: emit INSTANCE_REF and skip children.
    // Skipped when this INSTANCE is the user's selected root -- we expand
    // it fully so the user sees the content, not just a reference wrapper.
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
      // If the instance is itself a flat icon, expose the asset filePath.
      if (iconFilename) ref.filePath = `icons/${iconFilename}`;
      return ref;
    }
  }

  // ---- Generic / inline serialization (used for frame.yaml AND inside     -
  //      component definition files). --------------------------------------
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
  // Position (skip 0/0 noise at root).
  const x = safe(() => n.x);
  const y = safe(() => n.y);
  if (x !== undefined && x !== 0) out.x = x;
  if (y !== undefined && y !== 0) out.y = y;

  // ---- INSTANCE inside a component def: stay flat, no children expansion --
  if (n.type === "INSTANCE" && inComponentDef) {
    out.componentProperties =
      cleanInstanceProperties((n as InstanceNode).componentProperties);
    if (iconFilename) out.filePath = `icons/${iconFilename}`;
    return out;
  }

  // ---- INSTANCE as the user-selected root: add componentProperties + code   -
  //      mapping enrichment then fall through to full layout / style / children
  //      recursion below so the user sees the entire content of what they
  //      selected. -----------------------------------------------------------
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
    () => (n as unknown as { layoutSizingHorizontal?: string }).layoutSizingHorizontal
  );
  const lsv = safe(
    () => (n as unknown as { layoutSizingVertical?: string }).layoutSizingVertical
  );
  if (lsh) out.layoutSizingHorizontal = lsh;
  if (lsv) out.layoutSizingVertical = lsv;
  const la = safe(
    () => (n as unknown as { layoutAlign?: string }).layoutAlign
  );
  if (la && la !== "INHERIT") out.layoutAlign = la;

  // ---- Text content --------------------------------------------------------
  if (n.type === "TEXT") {
    const t = n as TextNode;
    if (typeof t.characters === "string") out.text = t.characters;
    const typoRef = registerTypography(t, n.name, ctx);
    // Style refs (fills + typography)
    const fillRefs = registerFillsForNode(n, ctx);
    const styleRefs: Record<string, unknown> = {};
    if (fillRefs.length) styleRefs.fills = fillRefs;
    if (typoRef) styleRefs.typography = typoRef;
    if (Object.keys(styleRefs).length) out.styleRefs = styleRefs;
    return out;
  }

  // ---- Style refs (fills / strokes / effects) -----------------------------
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
        kids.push(await buildNode(c, ctx, inComponentDef));
      } catch {
        /* skip un-serializable children */
      }
    }
    if (kids.length) out.children = kids;
  }

  return out;
}

// ---------------------------------------------------------------------------
// INSTANCE → components/<slug>.yaml definition
// ---------------------------------------------------------------------------

async function buildInstanceDefinition(
  n: InstanceNode,
  slug: string,
  ctx: Ctx
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
  if (n.layoutSizingHorizontal) def.layoutSizingHorizontal = n.layoutSizingHorizontal;
  if (n.layoutSizingVertical) def.layoutSizingVertical = n.layoutSizingVertical;

  // Component-side style refs
  const styleRefs: Record<string, unknown> = {};
  const fillRefs = registerFillsForNode(n, ctx);
  if (fillRefs.length) styleRefs.fills = fillRefs;
  const strokeRefs = registerStrokesForNode(n, ctx);
  if (strokeRefs.length) styleRefs.strokes = strokeRefs;
  const effectRefs = registerEffectsForNode(n, ctx);
  if (effectRefs.length) styleRefs.effects = effectRefs;
  if (Object.keys(styleRefs).length) def.styleRefs = styleRefs;

  // Enrich with code mapping if known
  const mc = await tryGetMain(n);
  const mapping = findMapping(ctx.mappings, mc?.name ?? n.name, mc?.key, n.id);
  if (mapping) {
    def.codeFilePath = mapping.codeFilePath;
    def.codeComponent = mapping.codeComponent;
    ctx.matchedCount++;
  }

  // Children — walk in-def so nested INSTANCEs stay flat.
  const kids: Record<string, unknown>[] = [];
  for (const c of n.children) {
    kids.push(await buildNode(c, ctx, /*inComponentDef*/ true));
  }
  if (kids.length) def.children = kids;

  void slug;
  return def;
}

function cleanInstanceProperties(
  cp: ComponentProperties | undefined
): Record<string, unknown> {
  if (!cp) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cp)) {
    out[k] = {
      value: (v as { value: unknown }).value,
      type: (v as { type: string }).type,
      isOverridden: (v as { boundVariables?: unknown }).boundVariables ? false : false,
    };
  }
  return out;
}

async function collectOverrides(n: InstanceNode): Promise<Array<{
  property: string;
  value: unknown;
  type: string;
}>> {
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

// ---------------------------------------------------------------------------
// Auto layout
// ---------------------------------------------------------------------------

function extractAutoLayout(n: SceneNode): Record<string, unknown> | undefined {
  if (!("layoutMode" in n)) return undefined;
  const m = n as unknown as {
    layoutMode?: string;
    itemSpacing?: number;
    paddingLeft?: number; paddingRight?: number;
    paddingTop?: number; paddingBottom?: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    primaryAxisSizingMode?: string;
    counterAxisSizingMode?: string;
    layoutSizingHorizontal?: string;
    layoutSizingVertical?: string;
    layoutWrap?: string;
    itemReverseZIndex?: boolean;
  };
  if (!m.layoutMode || m.layoutMode === "NONE") return undefined;

  const out: Record<string, unknown> = {
    direction: m.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
  };
  if (typeof m.itemSpacing === "number" && m.itemSpacing !== 0) out.spacing = m.itemSpacing;
  const padding: Record<string, number> = {};
  if (m.paddingTop) padding.top = m.paddingTop;
  if (m.paddingRight) padding.right = m.paddingRight;
  if (m.paddingBottom) padding.bottom = m.paddingBottom;
  if (m.paddingLeft) padding.left = m.paddingLeft;
  if (Object.keys(padding).length) out.padding = padding;
  if (m.primaryAxisAlignItems && m.primaryAxisAlignItems !== "MIN")
    out.primaryAxisAlignItems = m.primaryAxisAlignItems;
  if (m.counterAxisAlignItems && m.counterAxisAlignItems !== "MIN")
    out.counterAxisAlignItems = m.counterAxisAlignItems;
  if (m.primaryAxisSizingMode) out.primaryAxisSizingMode = m.primaryAxisSizingMode;
  if (m.counterAxisSizingMode) out.counterAxisSizingMode = m.counterAxisSizingMode;
  if (m.layoutSizingHorizontal) out.layoutSizingHorizontal = m.layoutSizingHorizontal;
  if (m.layoutSizingVertical) out.layoutSizingVertical = m.layoutSizingVertical;
  if (m.layoutWrap && m.layoutWrap !== "NO_WRAP") out.layoutWrap = m.layoutWrap;
  if (m.itemReverseZIndex) out.itemReverseZIndex = true;
  return out;
}

// ---------------------------------------------------------------------------
// Style registration (fills, strokes, effects, typography)
// ---------------------------------------------------------------------------

function registerFillsForNode(n: SceneNode, ctx: Ctx): string[] {
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

function registerStrokesForNode(n: SceneNode, ctx: Ctx): string[] {
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

function registerEffectsForNode(n: SceneNode, ctx: Ctx): string[] {
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

function registerTypography(t: TextNode, name: string, ctx: Ctx): string | undefined {
  const family = typeof t.fontName === "object" ? t.fontName.family : undefined;
  const style = typeof t.fontName === "object" ? t.fontName.style : undefined;
  const size = typeof t.fontSize === "number" ? t.fontSize : undefined;
  const fontWeight = inferFontWeight(style);
  const props: Record<string, unknown> = {
    text: typeof t.characters === "string" ? t.characters : undefined,
    fontFamily: family,
    fontSize: size,
    fontWeight,
    lineHeight: typeof t.lineHeight === "object" ? t.lineHeight : undefined,
    letterSpacing: typeof t.letterSpacing === "object" ? t.letterSpacing : undefined,
  };
  const sig = stableJson(props);
  const idBase = `typograph-text-${nodeIdFromFigma(name, t.id)}`;
  const entry = ensureStyle(ctx.typography, sig, idBase, name, "text", props);
  return `@styles/typography#${entry.id}`;
}

function inferFontWeight(style: string | undefined): number | undefined {
  if (!style) return undefined;
  const s = style.toLowerCase();
  if (s.includes("thin")) return 100;
  if (s.includes("extralight") || s.includes("ultra light")) return 200;
  if (s.includes("light")) return 300;
  if (s.includes("regular") || s.includes("normal") || s.includes("book")) return 400;
  if (s.includes("medium")) return 500;
  if (s.includes("semibold") || s.includes("semi bold") || s.includes("demi")) return 600;
  if (s.includes("extrabold") || s.includes("ultra bold")) return 800;
  if (s.includes("bold")) return 700;
  if (s.includes("black") || s.includes("heavy")) return 900;
  return 400;
}

function paintToProps(p: Paint): Record<string, unknown> {
  if (p.type === "SOLID") {
    return {
      type: "SOLID",
      color: rgbToHex(p.color, p.opacity ?? 1),
      opacity: p.opacity ?? 1,
      blendMode: p.blendMode ?? "NORMAL",
    };
  }
  return cleanFigmaValue(p) as Record<string, unknown>;
}

function effectToProps(e: Effect): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: e.type,
    blendMode: (e as unknown as { blendMode?: string }).blendMode ?? "NORMAL",
  };
  if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
    const ds = e as DropShadowEffect | InnerShadowEffect;
    base.color = rgbaToHex(ds.color);
    base.offset = { x: ds.offset.x, y: ds.offset.y };
    base.radius = ds.radius;
    base.blur = null;
    base.spread = (ds as DropShadowEffect).spread ?? 0;
  } else {
    base.radius = (e as unknown as { radius?: number }).radius;
  }
  return base;
}

function ensureStyle(
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

// ---------------------------------------------------------------------------
// Icon export
// ---------------------------------------------------------------------------

async function maybeExportIcon(n: SceneNode, ctx: Ctx): Promise<string | null> {
  if (ctx.iconNodeIds.has(n.id)) return null;
  const w = (n as unknown as { width?: number }).width ?? Infinity;
  const h = (n as unknown as { height?: number }).height ?? Infinity;
  const isSmall = w <= ICON_MAX && h <= ICON_MAX;
  const nameMatches = ICON_NAME_RE.test(n.name);

  const looksLikeIcon =
    (n.type === "VECTOR" && isSmall) ||
    (n.type === "BOOLEAN_OPERATION" && isSmall) ||
    (nameMatches &&
      (n.type === "INSTANCE" || n.type === "COMPONENT" || n.type === "FRAME"));

  if (!looksLikeIcon) return null;
  if (!("exportAsync" in n)) return null;

  try {
    const data = await (n as ExportMixin).exportAsync({ format: "SVG" });
    const filename = iconFilenameFor(n.name, n.id);
    ctx.icons.set(filename, data);
    ctx.iconNodeIds.add(n.id);
    return filename;
  } catch {
    return null;
  }
}

function iconFilenameFor(name: string, figmaId: string): string {
  const slug = slugify(name).replace(/-/g, "_") || "icon";
  const fid = figmaId.toLowerCase().replace(/[:;]/g, "_");
  return `ic_${slug}_${fid}.svg`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findMapping(
  mappings: ReadonlyArray<ComponentMapping>,
  figmaName: string,
  figmaComponentKey: string | undefined,
  figmaNodeId?: string
): ComponentMapping | undefined {
  if (figmaNodeId) {
    const hit = mappings.find((m) => m.figmaNodeId === figmaNodeId);
    if (hit) return hit;
  }
  if (figmaComponentKey) {
    const hit = mappings.find((m) => m.figmaComponentKey === figmaComponentKey);
    if (hit) return hit;
  }
  const exact = mappings.find((m) => m.figmaName === figmaName);
  if (exact) return exact;
  const norm = normaliseName(figmaName);
  return mappings.find((m) => normaliseName(m.figmaName) === norm);
}

function normaliseName(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function tryGetMain(n: InstanceNode): Promise<ComponentNode | null> {
  try { return await n.getMainComponentAsync(); } catch { return null; }
}

function nodeIdFromFigma(name: string, figmaId: string): string {
  const slug = slugify(name);
  // Take first segment up to ":" or ";" — "8248:51371" → "8248",
  // "I8248:51373;14:76676" → "I8248" → truncated to "I824".
  const head = figmaId.split(/[:;]/)[0];
  const idPart = head.startsWith("I") ? head.slice(0, 4) : head.slice(0, 4);
  return `${slug}-${idPart}`;
}

export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "node";
}

function rgbToHex(c: RGB, _a: number): string {
  const ch = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
}

function rgbaToHex(c: RGBA): string {
  const ch = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}${ch(c.a)}`;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    const v = fn();
    if (typeof v === "symbol") return undefined;
    return v;
  } catch {
    return undefined;
  }
}

function cleanFigmaValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "symbol") return "mixed";
  if (Array.isArray(value)) return value.map(cleanFigmaValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      try { out[k] = cleanFigmaValue((value as Record<string, unknown>)[k]); }
      catch { /* skip */ }
    }
    return out;
  }
  return value;
}

function stableJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const keys = Object.keys(v as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = walk((v as Record<string, unknown>)[k]);
    return out;
  };
  try { return JSON.stringify(walk(value)); } catch { return Math.random().toString(36); }
}

function dumpYaml(value: unknown): string {
  return yaml.dump(value, {
    noRefs: true,
    lineWidth: 120,
    skipInvalid: true,
    sortKeys: false,
  });
}

function textFile(content: string): SpexFile {
  return { kind: "text", content };
}

function binaryFile(base64: string): SpexFile {
  return { kind: "binary", base64 };
}

// Manual UTF-8 decoder. The Figma plugin main-runtime sandbox doesn't
// expose `TextDecoder`, so we can't use `new TextDecoder("utf-8")` here.
function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if ((b1 & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b1 & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      result += String.fromCharCode(
        ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      );
    } else if ((b1 & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const code =
        ((b1 & 0x07) << 18) |
        ((b2 & 0x3f) << 12) |
        ((b3 & 0x3f) << 6) |
        (b4 & 0x3f);
      const offset = code - 0x10000;
      result += String.fromCharCode(0xd800 + (offset >> 10));
      result += String.fromCharCode(0xdc00 + (offset & 0x3ff));
    }
    // else: malformed byte — skip silently
  }
  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Prefer Figma's built-in encoder when available (main-runtime sandbox).
  const fb = (figma as unknown as { base64Encode?: (b: Uint8Array) => string })
    .base64Encode;
  if (typeof fb === "function") return fb(bytes);

  // Fallback: chunked binary string → btoa.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  // btoa exists in the UI iframe; in the main runtime we rely on figma.base64Encode above.
  // eslint-disable-next-line no-restricted-globals
  return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
}

function README(
  m: SpexBundle["manifest"],
  ctx: Ctx
): string {
  return [
    `# SpeX Design Specs`,
    ``,
    `**Export Mode**: Shared Instance References`,
    `**Exported**: ${m.exportDate}`,
    ``,
    `## File Structure`,
    ``,
    `- \`frame.yaml\` — root frame with the full hierarchy and references`,
    `- \`/components/\` — one YAML per unique INSTANCE definition (deduplicated)`,
    `- \`/styles/\` — fills, strokes, effects, typography (deduplicated)`,
    `- \`/icons/\` — SVG exports for icon-like nodes`,
    `- \`/images/\` — PNG image fills (placeholder when empty)`,
    `- \`/previews/section.png\` — 2× PNG render of the root frame`,
    `- \`manifest.yaml\` — complete file index`,
    ``,
    `## Counts`,
    ``,
    `- nodes:              ${ctx.nodeCount}`,
    `- unique components:  ${ctx.components.size}`,
    `- mapped components:  ${ctx.matchedCount}`,
    `- fills:              ${ctx.fills.size}`,
    `- strokes:            ${ctx.strokes.size}`,
    `- effects:            ${ctx.effects.size}`,
    `- typography:         ${ctx.typography.size}`,
    `- icons:              ${ctx.icons.size}`,
    ``,
    `## Reference System`,
    ``,
    `### Style references`,
    `Style references use the format \`@styles/<category>#<style-id>\`.`,
    ``,
    `### Component references (Shared mode)`,
    `INSTANCE nodes in \`frame.yaml\` are emitted as \`INSTANCE_REF\` with`,
    `\`instanceRef: '@components/<slug>#<id>'\`. The full structure for each`,
    `unique component lives in \`components/<slug>.yaml\` and is shared by all`,
    `usages — overrides are inlined at the reference site only.`,
    ``,
    `## Code mapping metadata`,
    ``,
    `When a component has a saved mapping (see the Component Records Manager),`,
    `the YAML emits two extra fields the VS Code extension can use directly:`,
    ``,
    `- \`codeFilePath\` — path to the implementation file in your project`,
    `- \`codeComponent\` — name of the component in code`,
    ``,
  ].join("\n");
}
