import type {
  ComponentMapping,
  DesignTokenRef,
  FEComponentCatalogItem,
  ReviewComponent,
  SelectionTreeNode,
} from "../../shared/types";
import { isSavedMatch, matchMapping } from "../matcher";
import {
  loadComponentCatalog,
  loadTokenCatalog,
} from "../storage/catalogs";
import { loadMappings } from "../storage/mappings";
import {
  getMark,
  readExportPath,
  readIconName,
  readStickyMappingId,
} from "../storage/nodeData";
import { collectNodeTokens } from "../tokens/extractor";
import { loadLocalVariables } from "../tokens/variables";
import { getDisplayName } from "./displayName";
import { tryGetMain } from "./walk";

export interface ScanSummary {
  nodes: number;
  instances: number;
  textNodes: number;
  tree: SelectionTreeNode | null;
  reviewComponents: ReviewComponent[];
  tokens: DesignTokenRef[];
  unmatchedInstances: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
    displayName: string;
    mainComponentKey?: string;
  }>;
}

export async function summariseSelection(root: SceneNode): Promise<ScanSummary> {
  const mappings = await loadMappings();
  const components = await loadComponentCatalog();
  // Token extraction runs as part of "scan selection" so the Tokens tab
  // refreshes immediately, without waiting for a full Build.
  const tokenCatalog = await loadTokenCatalog();
  const localVars = await loadLocalVariables();
  const tokens = new Map<string, DesignTokenRef>();

  let nodes = 0;
  let instances = 0;
  let textNodes = 0;

  // Dedupe unmatched instances by their stable component identity
  // (figmaComponentKey when available, else figmaName), so a screen with
  // 30 copies of the same Button only adds one row.
  const unmatched: ScanSummary["unmatchedInstances"] = [];
  const unmatchedSeen = new Set<string>();

  const reviewComponents: ReviewComponent[] = [];
  const reviewSeen = new Set<string>();

  const buildTree = async (n: SceneNode): Promise<SelectionTreeNode> => {
    nodes++;
    if (n.type === "TEXT") textNodes++;

    await collectNodeTokens(n, tokens, tokenCatalog, localVars);

    let matched = false;
    let mappingName = n.name;
    let figmaComponentKey: string | undefined;
    let figmaComponentName: string | undefined;
    let codeComponent: string | undefined;
    let codeFilePath: string | undefined;
    let importType: "default" | "named" | undefined;
    let importName: string | undefined;

    if (n.type === "INSTANCE") {
      instances++;
      const mc = await tryGetMain(n as InstanceNode);
      const figmaName = mc?.name ?? n.name;
      mappingName = figmaName;
      figmaComponentKey = mc?.key;
      figmaComponentName = mc?.name;
      const sticky = readStickyMappingId(n);
      const m = matchMapping(
        {
          figmaName,
          figmaComponentKey: mc?.key,
          figmaNodeId: n.id,
          stickyMappingId: sticky,
        },
        mappings,
        components
      );
      // Only count as "matched" when the match comes from a user-saved
      // mapping (P0–P4). P5 catalog suggestions are unconfirmed.
      const savedMatch = isSavedMatch(m);
      matched = savedMatch;
      codeComponent = savedMatch ? m!.mapping.codeComponent : undefined;
      codeFilePath = savedMatch ? m!.mapping.codeFilePath : undefined;
      importType = savedMatch ? m!.mapping.importType : undefined;
      importName = savedMatch ? m!.mapping.importName : undefined;
      if (!savedMatch) {
        const dedupeKey = mc?.key ?? figmaName;
        if (!unmatchedSeen.has(dedupeKey)) {
          unmatchedSeen.add(dedupeKey);
          unmatched.push({
            nodeId: n.id,
            name: n.name,
            figmaName,
            displayName: getDisplayName(mc, n),
            mainComponentKey: mc?.key,
          });
        }
      }
      const key = mc?.key ?? figmaName;
      if (!reviewSeen.has(key)) {
        reviewSeen.add(key);
        reviewComponents.push({
          nodeId: n.id,
          name: figmaName,
          type: "INSTANCE",
          codeComponent: savedMatch ? m!.mapping.codeComponent : null,
          codeFilePath: savedMatch ? m!.mapping.codeFilePath : null,
        });
      }
    } else {
      const sticky = readStickyMappingId(n);
      const m = matchMapping(
        {
          figmaName: n.name,
          figmaNodeId: n.id,
          stickyMappingId: sticky,
        },
        mappings,
        components
      );
      const savedMatch = isSavedMatch(m);
      matched = savedMatch;
      codeComponent = savedMatch ? m!.mapping.codeComponent : undefined;
      codeFilePath = savedMatch ? m!.mapping.codeFilePath : undefined;
      importType = savedMatch ? m!.mapping.importType : undefined;
      importName = savedMatch ? m!.mapping.importName : undefined;
    }

    const assetMark = getMark(n);
    const assetIconName = readIconName(n);
    const assetExportPath = readExportPath(n);

    const treeNode: SelectionTreeNode = {
      id: n.id,
      name: n.name,
      type: n.type,
      isInstance: n.type === "INSTANCE",
      matched,
      mappingName,
      figmaComponentKey,
      figmaComponentName,
      codeComponent,
      codeFilePath,
      importType,
      importName,
      assetMark: assetMark ?? undefined,
      assetIconName: assetIconName || undefined,
      assetExportPath: assetExportPath || undefined,
    };

    if ("children" in n) {
      const kids: SelectionTreeNode[] = [];
      for (const c of (n as ChildrenMixin).children as SceneNode[]) {
        kids.push(await buildTree(c));
      }
      if (kids.length) treeNode.children = kids;
    }
    return treeNode;
  };

  const tree = await buildTree(root);

  reviewComponents.unshift(await buildRootReviewRow(root, mappings, components));

  return {
    nodes,
    instances,
    textNodes,
    tree,
    reviewComponents,
    tokens: Array.from(tokens.values()),
    unmatchedInstances: unmatched,
  };
}

async function buildRootReviewRow(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>
): Promise<ReviewComponent> {
  let codeComponent: string | null = null;
  let codeFilePath: string | null = null;
  if (root.type === "INSTANCE") {
    const mc = await tryGetMain(root as InstanceNode);
    const sticky = readStickyMappingId(root);
    const m = matchMapping(
      {
        figmaName: mc?.name ?? root.name,
        figmaComponentKey: mc?.key,
        figmaNodeId: root.id,
        stickyMappingId: sticky,
      },
      mappings,
      components
    );
    if (m) {
      codeComponent = m.mapping.codeComponent;
      codeFilePath = m.mapping.codeFilePath;
    }
  }
  return {
    nodeId: root.id,
    name: root.name,
    type: root.type,
    codeComponent,
    codeFilePath,
  };
}

