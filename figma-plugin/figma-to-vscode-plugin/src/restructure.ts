// restructure.ts
//
// Takes the raw Figma scan (a single nested node tree + variables + asset
// binaries) and re-organises it into a multi-folder "bundle" intended for
// consumption by the VS Code extension or a designer/developer browsing the
// ZIP:
//
//   <root>/
//   ├── manifest.yaml          # index + counts
//   ├── README.md              # format explanation
//   ├── frame.yaml             # the main selected frame tree
//   ├── components/            # one yaml per unique component
//   │   ├── card-header.yaml
//   │   ├── badge.yaml
//   │   └── ...
//   ├── styles/                # deduped style catalogues
//   │   ├── fills.yaml
//   │   ├── strokes.yaml
//   │   ├── effects.yaml
//   │   └── typography.yaml
//   ├── icons/                 # SVG exports for icon-like nodes
//   │   ├── close.svg
//   │   ├── check.svg
//   │   └── ...
//   ├── previews/              # PNG render of the selected frame
//   │   └── section.png
//   └── variables.yaml         # local Figma variables
//
// The bundle is also the wire-format used over WebSocket: the VS Code side
// receives the exact same `files` map and can write it to disk verbatim.

import yaml from "js-yaml";

export interface RawSpec {
  type: string;
  version: string;
  source: string;
  createdAt: string;
  file: { name: string; pageName: string };
  selection: SerializedNode;
  variables: unknown[];
}

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  children?: SerializedNode[];
  style?: {
    fills?: unknown;
    strokes?: unknown;
    strokeWeight?: unknown;
    effects?: unknown;
    cornerRadius?: unknown;
  };
  text?: {
    fontName?: { family?: string; style?: string } | "mixed";
    fontSize?: number | "mixed";
    lineHeight?: unknown;
    letterSpacing?: unknown;
    textCase?: string;
    textDecoration?: string;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  instance?: {
    mainComponent?: {
      id?: string;
      key?: string;
      name?: string;
      parentSet?: { id?: string; key?: string; name?: string } | null;
    } | null;
    variantProperties?: unknown;
    componentProperties?: unknown;
  };
  [k: string]: unknown;
}

export interface RawAssets {
  icons: Array<{
    filename: string;
    data: Uint8Array;
    sourceNodeId: string;
    sourceNodeName: string;
  }>;
  preview: { filename: string; data: Uint8Array } | null;
}

export type BundleFile =
  | { kind: "text"; content: string }
  | { kind: "binary"; base64: string };

export interface Bundle {
  /** Top-level "what's inside" — also serialised to manifest.yaml */
  manifest: BundleManifest;
  /** Path → file. Both Download (ZIP) and Send (WebSocket) use this. */
  files: Record<string, BundleFile>;
  /** Convenience root-folder name (used by the ZIP). */
  rootSlug: string;
}

export interface BundleManifest {
  type: string;
  version: string;
  source: string;
  createdAt: string;
  file: { name: string; pageName: string };
  frame: { id: string; name: string; type: string; width?: number; height?: number };
  counts: {
    components: number;
    fills: number;
    strokes: number;
    effects: number;
    typography: number;
    icons: number;
    variables: number;
  };
  index: {
    frame: string;
    components: string[];
    styles: { fills: string; strokes: string; effects: string; typography: string };
    icons: string[];
    previews: string[];
    variables: string;
    readme: string;
  };
}

const YAML_OPTS: yaml.DumpOptions = {
  noRefs: true,
  lineWidth: 120,
  skipInvalid: true,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildBundle(spec: RawSpec, assets: RawAssets): Bundle {
  const rootSlug = slugify(spec.selection?.name || "design-spec");

  const components = extractUniqueComponents(spec.selection);
  const styles = extractStyles(spec.selection);

  const files: Record<string, BundleFile> = {};

  // ---- frame.yaml ----------------------------------------------------------
  files["frame.yaml"] = textFile(yaml.dump(spec.selection, YAML_OPTS));

  // ---- components/ ---------------------------------------------------------
  const componentPaths: string[] = [];
  for (const c of components) {
    const path = `components/${c.slug}.yaml`;
    componentPaths.push(path);
    files[path] = textFile(yaml.dump(c.payload, YAML_OPTS));
  }

  // ---- styles/ -------------------------------------------------------------
  files["styles/fills.yaml"] = textFile(yaml.dump(styles.fills, YAML_OPTS));
  files["styles/strokes.yaml"] = textFile(yaml.dump(styles.strokes, YAML_OPTS));
  files["styles/effects.yaml"] = textFile(yaml.dump(styles.effects, YAML_OPTS));
  files["styles/typography.yaml"] = textFile(
    yaml.dump(styles.typography, YAML_OPTS)
  );

  // ---- icons/ --------------------------------------------------------------
  const iconPaths: string[] = [];
  for (const icon of assets.icons) {
    const path = `icons/${icon.filename}`;
    iconPaths.push(path);
    // SVG is text — decode UTF-8 from the Uint8Array Figma returned.
    files[path] = textFile(decodeUtf8(icon.data));
  }

  // ---- previews/ -----------------------------------------------------------
  const previewPaths: string[] = [];
  if (assets.preview) {
    const path = `previews/${assets.preview.filename}`;
    previewPaths.push(path);
    files[path] = binaryFile(uint8ToBase64(assets.preview.data));
  }

  // ---- variables.yaml ------------------------------------------------------
  files["variables.yaml"] = textFile(
    yaml.dump(spec.variables ?? [], YAML_OPTS)
  );

  // ---- manifest.yaml -------------------------------------------------------
  const manifest: BundleManifest = {
    type: spec.type,
    version: spec.version,
    source: spec.source,
    createdAt: spec.createdAt,
    file: spec.file,
    frame: {
      id: spec.selection?.id,
      name: spec.selection?.name,
      type: spec.selection?.type,
      width: (spec.selection as unknown as { width?: number })?.width,
      height: (spec.selection as unknown as { height?: number })?.height,
    },
    counts: {
      components: components.length,
      fills: styles.fills.length,
      strokes: styles.strokes.length,
      effects: styles.effects.length,
      typography: styles.typography.length,
      icons: iconPaths.length,
      variables: (spec.variables ?? []).length,
    },
    index: {
      frame: "frame.yaml",
      components: componentPaths,
      styles: {
        fills: "styles/fills.yaml",
        strokes: "styles/strokes.yaml",
        effects: "styles/effects.yaml",
        typography: "styles/typography.yaml",
      },
      icons: iconPaths,
      previews: previewPaths,
      variables: "variables.yaml",
      readme: "README.md",
    },
  };
  files["manifest.yaml"] = textFile(yaml.dump(manifest, YAML_OPTS));

  // ---- README.md -----------------------------------------------------------
  files["README.md"] = textFile(buildReadme(manifest));

  return { manifest, files, rootSlug };
}

// ---------------------------------------------------------------------------
// Component extraction
// ---------------------------------------------------------------------------

interface ComponentEntry {
  key: string;
  name: string;
  slug: string;
  payload: Record<string, unknown>;
}

function extractUniqueComponents(root: SerializedNode | undefined): ComponentEntry[] {
  if (!root) return [];

  const byKey = new Map<string, ComponentEntry>();
  const usedSlugs = new Set<string>();

  const claimSlug = (name: string): string => {
    let base = slugify(name);
    if (!base) base = "component";
    if (!usedSlugs.has(base)) {
      usedSlugs.add(base);
      return base;
    }
    let i = 2;
    while (usedSlugs.has(`${base}-${i}`)) i++;
    const slug = `${base}-${i}`;
    usedSlugs.add(slug);
    return slug;
  };

  function visit(node: SerializedNode): void {
    if (node.type === "INSTANCE" && node.instance?.mainComponent) {
      const mc = node.instance.mainComponent;
      const key = (mc.key || mc.id || mc.name || node.name) ?? "";
      if (key && !byKey.has(key)) {
        const name = mc.name || node.name || "component";
        byKey.set(key, {
          key,
          name,
          slug: claimSlug(name),
          payload: {
            key,
            name,
            kind: "instance-of-component",
            mainComponent: mc,
            variantProperties: node.instance.variantProperties ?? null,
            componentProperties: node.instance.componentProperties ?? null,
            representativeInstance: stripDeepChildren(node),
          },
        });
      }
    }

    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      const key = (node as unknown as { id?: string }).id || node.name;
      if (key && !byKey.has(key)) {
        byKey.set(key, {
          key,
          name: node.name,
          slug: claimSlug(node.name),
          payload: {
            key,
            name: node.name,
            kind: node.type === "COMPONENT" ? "component" : "component-set",
            definition: node,
          },
        });
      }
    }

    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c);
    }
  }

  visit(root);
  return Array.from(byKey.values()).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
}

function stripDeepChildren(node: SerializedNode): SerializedNode {
  const { children, ...rest } = node;
  return {
    ...rest,
    children: Array.isArray(children)
      ? children.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }))
      : undefined,
  } as SerializedNode;
}

// ---------------------------------------------------------------------------
// Style extraction (dedupe across the entire tree)
// ---------------------------------------------------------------------------

interface StyleEntry<T> {
  id: string;
  signature: string;
  value: T;
  usageCount: number;
}

interface ExtractedStyles {
  fills: StyleEntry<unknown>[];
  strokes: StyleEntry<unknown>[];
  effects: StyleEntry<unknown>[];
  typography: StyleEntry<Record<string, unknown>>[];
}

function extractStyles(root: SerializedNode | undefined): ExtractedStyles {
  const fills = new Map<string, StyleEntry<unknown>>();
  const strokes = new Map<string, StyleEntry<unknown>>();
  const effects = new Map<string, StyleEntry<unknown>>();
  const typography = new Map<string, StyleEntry<Record<string, unknown>>>();

  function bump<T>(
    map: Map<string, StyleEntry<T>>,
    sig: string,
    value: T,
    prefix: string
  ): void {
    const existing = map.get(sig);
    if (existing) {
      existing.usageCount += 1;
      return;
    }
    map.set(sig, {
      id: `${prefix}_${String(map.size + 1).padStart(3, "0")}`,
      signature: sig,
      value,
      usageCount: 1,
    });
  }

  function visit(node: SerializedNode): void {
    const style = node.style;
    if (style) {
      if (Array.isArray(style.fills)) {
        for (const paint of style.fills as unknown[]) {
          bump(fills, stableStringify(paint), paint, "fill");
        }
      }
      if (Array.isArray(style.strokes)) {
        for (const paint of style.strokes as unknown[]) {
          bump(strokes, stableStringify(paint), paint, "stroke");
        }
      }
      if (Array.isArray(style.effects)) {
        for (const ef of style.effects as unknown[]) {
          bump(effects, stableStringify(ef), ef, "effect");
        }
      }
    }

    if (node.text) {
      const t = node.text;
      const family =
        t.fontName && typeof t.fontName === "object"
          ? (t.fontName as { family?: string }).family
          : undefined;
      const fontStyle =
        t.fontName && typeof t.fontName === "object"
          ? (t.fontName as { style?: string }).style
          : undefined;
      const sig: Record<string, unknown> = {
        fontFamily: family ?? null,
        fontStyle: fontStyle ?? null,
        fontSize: t.fontSize ?? null,
        lineHeight: t.lineHeight ?? null,
        letterSpacing: t.letterSpacing ?? null,
        textCase: t.textCase ?? null,
        textDecoration: t.textDecoration ?? null,
      };
      bump(typography, stableStringify(sig), sig, "type");
    }

    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c);
    }
  }

  if (root) visit(root);

  return {
    fills: Array.from(fills.values()),
    strokes: Array.from(strokes.values()),
    effects: Array.from(effects.values()),
    typography: Array.from(typography.values()),
  };
}

// ---------------------------------------------------------------------------
// README generation
// ---------------------------------------------------------------------------

function buildReadme(m: BundleManifest): string {
  const lines: string[] = [];
  lines.push(`# ${m.frame.name} — Figma design spec`);
  lines.push("");
  lines.push(
    `Generated by **figma-to-vscode-plugin** on ${m.createdAt}` +
      ` from \`${m.file.name}\` / \`${m.file.pageName}\`.`
  );
  lines.push("");
  lines.push("## Layout");
  lines.push("");
  lines.push("```");
  lines.push("manifest.yaml         # top-level index + counts");
  lines.push("README.md             # this file");
  lines.push("frame.yaml            # the selected frame, full serialized tree");
  lines.push("components/           # one YAML per unique component");
  for (const p of m.index.components.slice(0, 6)) {
    lines.push(`  ${p.replace(/^components\//, "")}`);
  }
  if (m.index.components.length > 6) lines.push("  …");
  lines.push("styles/");
  lines.push("  fills.yaml          # deduped fill paints (solid, gradient, image)");
  lines.push("  strokes.yaml        # deduped stroke paints");
  lines.push("  effects.yaml        # shadows + blurs");
  lines.push("  typography.yaml     # text styles (font, size, line height …)");
  lines.push("icons/                # SVG exports for icon-like nodes");
  for (const p of m.index.icons.slice(0, 6)) {
    lines.push(`  ${p.replace(/^icons\//, "")}`);
  }
  if (m.index.icons.length > 6) lines.push("  …");
  lines.push("previews/             # PNG render of the frame");
  lines.push("variables.yaml        # local Figma variables");
  lines.push("```");
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`- components: ${m.counts.components}`);
  lines.push(`- fills:      ${m.counts.fills}`);
  lines.push(`- strokes:    ${m.counts.strokes}`);
  lines.push(`- effects:    ${m.counts.effects}`);
  lines.push(`- typography: ${m.counts.typography}`);
  lines.push(`- icons:      ${m.counts.icons}`);
  lines.push(`- variables:  ${m.counts.variables}`);
  lines.push("");
  lines.push("## Spec format");
  lines.push("");
  lines.push("Every YAML file is plain data, no anchors / refs.");
  lines.push("");
  lines.push("### frame.yaml");
  lines.push(
    "The selected frame as a recursive tree. Each node has `id`, `name`, " +
      "`type`, geometry (`x`, `y`, `width`, `height`), `layout` (auto-layout), " +
      "`style` (fills, strokes, effects, corner radius), optional `text`, " +
      "optional `instance`, and `children`."
  );
  lines.push("");
  lines.push("### components/*.yaml");
  lines.push(
    "One entry per unique component instance referenced by `frame.yaml`. " +
      "Keyed by Figma `key` (or id when local). Includes `mainComponent`, " +
      "`variantProperties`, `componentProperties`, and a representative " +
      "instance with one level of children for context."
  );
  lines.push("");
  lines.push("### styles/*.yaml");
  lines.push(
    "Each style file is a list of `{ id, signature, value, usageCount }`. " +
      "`id` is stable per file (e.g. `fill_001`). `signature` is the " +
      "canonical JSON used to dedupe. `value` is the original Figma struct."
  );
  lines.push("");
  lines.push("### icons/*.svg");
  lines.push(
    "Raw SVG exports. Selected by name heuristic (`icon/*`, `close`, " +
      "`check`, `chevron*`, `arrow*`, …) and small `VECTOR` / " +
      "`BOOLEAN_OPERATION` nodes."
  );
  lines.push("");
  lines.push("### previews/section.png");
  lines.push("PNG render of the root frame at 2x scale.");
  lines.push("");
  lines.push("### variables.yaml");
  lines.push(
    "Local Figma variables (`id`, `key`, `name`, `resolvedType`, " +
      "`valuesByMode`, `scopes`). The VS Code extension should map these to " +
      "design tokens in your codebase."
  );
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function slugify(s: string): string {
  const out = (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "node";
}

function textFile(content: string): BundleFile {
  return { kind: "text", content };
}

function binaryFile(base64: string): BundleFile {
  return { kind: "binary", base64 };
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  // Chunked conversion to avoid arg-count limits in String.fromCharCode.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function stableStringify(value: unknown): string {
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
  try {
    return JSON.stringify(walk(value));
  } catch {
    return Math.random().toString(36);
  }
}
