import type { AssetRef } from "./assets";
import type { DesignTokenRef } from "./tokens";
import type { TokenKind } from "./catalogs";

export type SpecNode =
  | ComponentRefSpec
  | LayoutSpec
  | TextSpec
  | AssetRefSpec;

export interface ComponentContentText {
  name: string;
  value: string;
}

export interface ComponentContent {
  texts?: ComponentContentText[];
  components?: SpecNode[];
  truncated?: boolean;
}

export interface ComponentRefSpec {
  type: "component_ref";
  figmaName: string;
  figmaNodeId: string;
  codeComponent: string;
  codeFilePath: string;
  importType: "default" | "named";
  importName?: string;
  content?: ComponentContent;
  children?: SpecNode[];
  pruned: true;
  confidence: number;
}

export interface LayoutSpec {
  type: "layout_node";
  name: string;
  figmaNodeId: string;
  figmaType: string;
  layout?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  children?: SpecNode[];
}

export interface TextSpec {
  type: "text_node";
  name: string;
  figmaNodeId: string;
  text: string;
  typography?: { id?: string; tokenRef?: string; raw?: Record<string, unknown> };
  fill?: { tokenRef?: string; raw?: unknown };
}

export interface AssetRefSpec {
  type: "asset_ref";
  assetType: "icon" | "image" | "vector";
  name: string;
  path: string;
  filePath: string;
  figmaType: string;
  figmaNodeId: string;
  exported: boolean;
}

export interface MappingReport {
  matched: number;
  unmatched: number;
  ignored: number;
  totalInstances: number;
  tokenCoverage: number;
  confidence: number;
  matchedDetails: Array<{
    figmaName: string;
    codeComponent: string;
    confidence: number;
  }>;
  unmatchedDetails: Array<{
    figmaName: string;
    figmaType: string;
    nodeId: string;
  }>;
  missingTokens: Array<{ figmaTokenName: string; type: TokenKind }>;
}

export interface CompressedSpec {
  version: string;
  source: string;
  createdAt: string;
  figma: {
    fileName: string;
    pageName: string;
    selectedNodeId: string;
    selectedNodeName: string;
  };
  screen: {
    name: string;
    width: number;
    height: number;
    children: SpecNode[];
  };
  componentsUsed: Array<{
    figmaName: string;
    codeComponent: string;
    codeFilePath: string;
    importType: "default" | "named";
    importName?: string;
    confidence: number;
    occurrences: number;
  }>;
  tokens: DesignTokenRef[];
  assets: AssetRef[];
  mappingReport: MappingReport;
}
