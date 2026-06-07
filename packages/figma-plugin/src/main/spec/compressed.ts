import { PLUGIN_VERSION } from "../../shared/constants";
import type {
  ComponentMapping,
  CompressedSpec,
  FEComponentCatalogItem,
  FETokenCatalogItem,
  LayoutSpec,
  MappingReport,
  SpecNode,
} from "../../shared/types";
import { loadLocalVariables } from "../tokens/variables";
import type { BuildCtx } from "./ctx";
import { buildNode } from "./node";

export async function buildCompressedSpec(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>,
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>
): Promise<CompressedSpec> {
  const localVars = await loadLocalVariables();
  const ctx: BuildCtx = {
    mappings,
    components,
    tokenCatalog,
    localVars,
    tokens: new Map(),
    assets: [],
    matched: 0,
    unmatched: 0,
    ignored: 0,
    totalInstances: 0,
    confidenceSum: 0,
    matchedDetails: [],
    unmatchedDetails: [],
    componentsUsed: new Map(),
  };

  const rootSpec = await buildNode(root, ctx, true);

  const matchedAvg = ctx.matched ? ctx.confidenceSum / ctx.matched : 0;
  const tokenCoverage =
    ctx.tokens.size === 0
      ? 1
      : Array.from(ctx.tokens.values()).filter((t) => t.codeTokenName).length /
        ctx.tokens.size;

  const report: MappingReport = {
    matched: ctx.matched,
    unmatched: ctx.unmatched,
    ignored: ctx.ignored,
    totalInstances: ctx.totalInstances,
    tokenCoverage,
    confidence: matchedAvg,
    matchedDetails: ctx.matchedDetails,
    unmatchedDetails: ctx.unmatchedDetails,
    missingTokens: Array.from(ctx.tokens.values())
      .filter((t) => !t.codeTokenName)
      .map((t) => ({ figmaTokenName: t.figmaTokenName, type: t.type })),
  };

  const screenChildren: SpecNode[] = Array.isArray(
    (rootSpec as LayoutSpec).children
  )
    ? ((rootSpec as LayoutSpec).children as SpecNode[])
    : [rootSpec];

  return {
    version: PLUGIN_VERSION,
    source: "figma-clarity-nwa",
    createdAt: new Date().toISOString(),
    figma: {
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectedNodeId: root.id,
      selectedNodeName: root.name,
    },
    screen: {
      name: root.name,
      width: "width" in root ? root.width : 0,
      height: "height" in root ? root.height : 0,
      children: screenChildren,
    },
    componentsUsed: Array.from(ctx.componentsUsed.values()),
    tokens: Array.from(ctx.tokens.values()),
    assets: ctx.assets,
    mappingReport: report,
  };
}
