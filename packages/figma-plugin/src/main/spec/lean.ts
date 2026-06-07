import type {
  ComponentContent,
  CompressedSpec,
  LayoutSpec,
  LeanAsset,
  LeanComponent,
  LeanContent,
  LeanLayout,
  LeanNode,
  LeanSpec,
  LeanText,
  SpecNode,
} from "../../shared/types";

export function buildLeanSpec(spec: CompressedSpec): LeanSpec {
  const r = spec.mappingReport;
  return {
    version: spec.version,
    createdAt: spec.createdAt,
    figma: {
      fileName: spec.figma.fileName,
      pageName: spec.figma.pageName,
      selectedNodeName: spec.figma.selectedNodeName,
    },
    screen: {
      name: spec.screen.name,
      width: spec.screen.width,
      height: spec.screen.height,
      children: spec.screen.children
        .map(toLeanNode)
        .filter((n): n is LeanNode => n !== null),
    },
    componentsUsed: spec.componentsUsed.map((c) => ({
      codeComponent: c.codeComponent,
      codeFilePath: c.codeFilePath,
      importType: c.importType,
      ...(c.importName ? { importName: c.importName } : {}),
      occurrences: c.occurrences,
    })),
    tokens: spec.tokens.map((t) => ({
      name: t.figmaTokenName,
      type: t.type,
      ...(t.codeTokenName ? { codeTokenName: t.codeTokenName } : {}),
      ...(t.codeTokenPath ? { codeTokenPath: t.codeTokenPath } : {}),
      usageCount: t.usageCount,
    })),
    assets: spec.assets.map((a) => ({
      type: a.type,
      name: a.name,
      path: a.path,
      filePath: a.filePath,
      format: a.format,
    })),
    stats: {
      totalInstances: r.totalInstances,
      matched: r.matched,
      unmatched: r.unmatched,
      confidence: r.confidence,
      tokenCoverage: r.tokenCoverage,
    },
  };
}

function toLeanNode(node: SpecNode): LeanNode | null {
  switch (node.type) {
    case "component_ref": {
      const out: LeanComponent = {
        codeComponent: node.codeComponent,
        codeFilePath: node.codeFilePath,
      };
      // importType / importName only matter when they differ from the safe
      // default ("named" + same name). Hide them when redundant.
      if (node.importType === "default") {
        out.importType = "default";
        if (node.importName && node.importName !== node.codeComponent) {
          out.importName = node.importName;
        }
      }
      if (node.content) {
        const leanContent = leanifyContent(node.content);
        if (leanContent) {
          out.content = leanContent;
        }
      }
      if (node.children?.length) {
        const kids = node.children
          .map(toLeanNode)
          .filter((c): c is LeanNode => c !== null);
        if (kids.length) {
          out.children = kids;
        }
      }
      return out;
    }
    case "layout_node": {
      const kids = (node.children ?? [])
        .map(toLeanNode)
        .filter((c): c is LeanNode => c !== null);
      if (kids.length === 0 && !node.layout && !node.styles) {
        return null;
      }
      const out: LeanLayout = {
        layout: describeLayout(node),
      };
      if (node.styles && Object.keys(node.styles).length > 0) {
        const cleanedStyles = cleanStyles(node.styles);
        if (Object.keys(cleanedStyles).length > 0) {
          out.styles = cleanedStyles;
        }
      }
      if (kids.length) {
        out.children = kids;
      }
      return out;
    }
    case "text_node": {
      const out: LeanText = { text: node.text };
      const tokenRef = node.typography?.tokenRef;
      if (tokenRef) {
        out.typography = tokenRef;
      }
      return out;
    }
    case "asset_ref": {
      const out: LeanAsset = {
        asset: node.assetType,
        path: node.filePath || node.path,
        name: node.name,
        figmaType: node.figmaType,
      };
      return out;
    }
  }
}

// Render a layout_node's auto-layout intent as a short string the consumer can
// scan visually (e.g. "row gap:8 pad:16,24,16,24").
function describeLayout(node: LayoutSpec): string {
  const layout = node.layout as
    | {
        display?: string;
        direction?: string;
        gap?: number;
        padding?: { top?: number; right?: number; bottom?: number; left?: number };
        justify?: string;
        align?: string;
      }
    | undefined;
  if (!layout || !layout.direction) {
    return node.name || "container";
  }
  const parts: string[] = [layout.direction === "row" ? "row" : "column"];
  if (typeof layout.gap === "number" && layout.gap !== 0) {
    parts.push(`gap:${layout.gap}`);
  }
  if (layout.padding) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = layout.padding;
    if (top || right || bottom || left) {
      parts.push(`pad:${top},${right},${bottom},${left}`);
    }
  }
  if (layout.justify && layout.justify !== "MIN") {
    parts.push(`justify:${layout.justify.toLowerCase()}`);
  }
  if (layout.align && layout.align !== "MIN") {
    parts.push(`align:${layout.align.toLowerCase()}`);
  }
  return parts.join(" ");
}

function leanifyContent(content: ComponentContent): LeanContent | undefined {
  const out: LeanContent = {};
  if (content.texts && content.texts.length) {
    out.texts = content.texts;
  }
  if (content.components && content.components.length) {
    const leanComponents = content.components
      .map(toLeanNode)
      .filter((c): c is LeanNode => c !== null);
    if (leanComponents.length) {
      out.components = leanComponents;
    }
  }
  if (content.truncated) {
    out.truncated = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function cleanStyles(styles: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const fills = styles.fills;
  if (Array.isArray(fills) && fills.length > 0) {
    const first = fills[0] as { tokenRef?: string; hex?: string };
    if (first?.tokenRef) {
      out.fill = first.tokenRef;
    } else if (first?.hex) {
      out.fill = first.hex;
    }
  }

  const strokes = styles.strokes;
  if (Array.isArray(strokes) && strokes.length > 0) {
    const first = strokes[0] as { tokenRef?: string; hex?: string };
    if (first?.tokenRef) {
      out.stroke = first.tokenRef;
    } else if (first?.hex) {
      out.stroke = first.hex;
    }
  }

  if (typeof styles.cornerRadius === "number") {
    out.radius = styles.cornerRadius;
  } else if (
    styles.cornerRadius &&
    typeof styles.cornerRadius === "object" &&
    (styles.cornerRadius as { tokenRef?: string }).tokenRef
  ) {
    out.radius = (styles.cornerRadius as { tokenRef: string }).tokenRef;
  }

  if (Array.isArray(styles.effects) && styles.effects.length > 0) {
    out.shadow = "yes";
  }
  if (typeof styles.opacity === "number") {
    out.opacity = styles.opacity;
  }
  return out;
}
