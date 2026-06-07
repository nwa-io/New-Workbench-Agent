import type {
  AssetRefSpec,
  ComponentRefSpec,
  LayoutSpec,
  SpecNode,
} from "../../shared/types";
import { slugify } from "../../shared/util/slugify";
import { exportAssetForNode } from "../assets/export";
import { matchMapping } from "../matcher";
import {
  getMark,
  readExportPath,
  readIconName,
  readStickyMappingId,
} from "../storage/nodeData";
import { tryGetMain } from "../scan/walk";
import { collectContent } from "./content";
import type { BuildCtx } from "./ctx";
import { isMappableContainer } from "./ctx";
import { extractLayout } from "./layout";
import { extractStylesWithTokens } from "./styles";
import { buildTextNode } from "./text";

export async function buildNode(
  n: SceneNode,
  ctx: BuildCtx,
  // When true, this is the node the user explicitly selected. We never prune
  // the root: even if it matches a mapping, we serialize its full subtree.
  isRoot: boolean = false
): Promise<SpecNode> {
  const mark = getMark(n);
  if (mark === "ignored") {
    ctx.ignored++;
    return {
      type: "layout_node",
      name: n.name,
      figmaNodeId: n.id,
      figmaType: n.type,
    };
  }

  // Asset marks short-circuit children and produce an asset_ref. Always
  // emit the asset_ref when a mark is present — even if exportAsync
  // failed to produce binary bytes — so the JSON consumer sees the
  // user's intent (name + filePath) instead of the full subtree.
  if (mark === "icon" || mark === "image" || mark === "vector") {
    const ref = await exportAssetForNode(n, mark);
    if (ref) ctx.assets.push(ref);

    const customName = readIconName(n);
    const slug = slugify(n.name) || "asset";
    const name = customName || slug;
    const format: "svg" | "png" = mark === "image" ? "png" : "svg";
    const folder =
      mark === "icon" ? "icons" : mark === "vector" ? "vectors" : "images";
    const customPath = readExportPath(n);
    const filePath = customPath || `${folder}/${name}.${format}`;
    const legacyPath = ref?.path ?? `@${folder}/${name}.${format}`;
    const spec: AssetRefSpec = {
      type: "asset_ref",
      assetType: mark,
      name,
      path: legacyPath,
      filePath,
      figmaType: n.type,
      figmaNodeId: n.id,
      exported: !!ref,
    };
    return spec;
  }

  // INSTANCE → mapping?
  // For the user-selected root we skip the prune-to-ref path so the full
  // content is visible. Nested INSTANCEs further down are still pruned.
  if (n.type === "INSTANCE" && !isRoot) {
    ctx.totalInstances++;
    const mc = await tryGetMain(n as InstanceNode);
    const figmaName = mc?.name ?? n.name;
    const sticky = readStickyMappingId(n);
    const match = matchMapping(
      {
        figmaName,
        figmaComponentKey: mc?.key,
        figmaNodeId: n.id,
        stickyMappingId: sticky,
      },
      ctx.mappings,
      ctx.components
    );

    if (match) {
      registerMatch(ctx, figmaName, match.confidence, match.mapping);
      const content = await collectContent(n, ctx);
      const spec: ComponentRefSpec = {
        type: "component_ref",
        figmaName,
        figmaNodeId: n.id,
        codeComponent: match.mapping.codeComponent,
        codeFilePath: match.mapping.codeFilePath,
        importType: match.mapping.importType,
        importName: match.mapping.importName,
        ...(content ? { content } : {}),
        pruned: true,
        confidence: match.confidence,
      };
      return spec;
    } else {
      ctx.unmatched++;
      ctx.unmatchedDetails.push({
        figmaName,
        figmaType: n.type,
        nodeId: n.id,
      });
      // Fall through and treat as a layout node so design intent isn't lost.
    }
  }

  // FRAME / GROUP / SECTION / COMPONENT → user-mapped to a code component?
  // The Table -> IposTable case: the user maps a regular FRAME (not an
  // INSTANCE) to a component file via the tree-node panel. We collapse the
  // subtree the same way we do for INSTANCEs.
  if (!isRoot && isMappableContainer(n.type)) {
    const sticky = readStickyMappingId(n);
    const match = matchMapping(
      {
        figmaName: n.name,
        figmaNodeId: n.id,
        stickyMappingId: sticky,
      },
      ctx.mappings,
      ctx.components
    );
    if (match) {
      ctx.totalInstances++;
      registerMatch(ctx, n.name, match.confidence, match.mapping);
      const content = await collectContent(n, ctx);
      const spec: ComponentRefSpec = {
        type: "component_ref",
        figmaName: n.name,
        figmaNodeId: n.id,
        codeComponent: match.mapping.codeComponent,
        codeFilePath: match.mapping.codeFilePath,
        importType: match.mapping.importType,
        importName: match.mapping.importName,
        ...(content ? { content } : {}),
        pruned: true,
        confidence: match.confidence,
      };
      return spec;
    }
  }

  if (n.type === "TEXT") {
    return await buildTextNode(n as TextNode, ctx);
  }

  // Default → layout_node with extracted layout + (compact) styles + recurse
  const layout = extractLayout(n);
  const styles = await extractStylesWithTokens(n, ctx);
  const children: SpecNode[] = [];
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      children.push(await buildNode(c, ctx));
    }
  }
  const spec: LayoutSpec = {
    type: "layout_node",
    name: n.name,
    figmaNodeId: n.id,
    figmaType: n.type,
    layout,
    styles,
    children: children.length ? children : undefined,
  };
  return spec;
}

function registerMatch(
  ctx: BuildCtx,
  figmaName: string,
  confidence: number,
  mapping: BuildCtx["mappings"][number]
): void {
  ctx.matched++;
  ctx.confidenceSum += confidence;
  ctx.matchedDetails.push({
    figmaName,
    codeComponent: mapping.codeComponent,
    confidence,
  });
  const key = mapping.codeComponent + "@" + mapping.codeFilePath;
  const existing = ctx.componentsUsed.get(key);
  if (existing) {
    existing.occurrences++;
  } else {
    ctx.componentsUsed.set(key, {
      figmaName,
      codeComponent: mapping.codeComponent,
      codeFilePath: mapping.codeFilePath,
      importType: mapping.importType,
      importName: mapping.importName,
      confidence,
      occurrences: 1,
    });
  }
}
