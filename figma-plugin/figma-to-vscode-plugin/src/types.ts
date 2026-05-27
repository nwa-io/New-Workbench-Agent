// types.ts — shared between code.ts (main runtime) and ui.ts (iframe).

export const PLUGIN_NAME = "Figma to VS Code Sender";
export const PLUGIN_VERSION = "0.3.0";

// ---------- Component mapping registry --------------------------------------

export interface ComponentMapping {
  id: string;
  figmaName: string;
  figmaNodeId?: string;
  figmaComponentKey?: string;
  figmaVariant?: Record<string, string>;

  codeComponent: string;
  codeFilePath: string;
  importType: "default" | "named";
  importName?: string;

  propMapping?: Record<string, string>; // figmaProp → codeProp
  defaultProps?: Record<string, unknown>;
  mergeChildProps?: boolean;

  confidence: number; // 0..1
  source: "manual" | "auto-suggested" | "confirmed";
  updatedAt: string;

  // Optional metadata shown in the Component Records Manager
  previewUiUrl?: string;
  description?: string;
}

// ---------- Per-node marks (asset / ignore) ---------------------------------

export type AssetMark =
  | "icon"
  | "image"
  | "vector"
  | "illustration"
  | "decorative"
  | "ignored"
  | null;

// ---------- Catalogs received from VS Code ----------------------------------

export interface FEComponentCatalogItem {
  componentName: string;
  filePath: string;
  exportType: "default" | "named";
  props?: Array<{ name: string; type: string }>;
  framework?: string;
  aliases?: string[];
  examples?: string[];
}

export interface FETokenCatalogItem {
  name: string;
  value: unknown;
  filePath?: string;
  type?: TokenKind;
}

export type TokenKind =
  | "color"
  | "spacing"
  | "typography"
  | "radius"
  | "shadow"
  | "opacity"
  | "other";

// ---------- Design tokens extracted from the Figma selection ---------------

export interface DesignTokenRef {
  figmaTokenName: string;
  figmaVariableId?: string;
  figmaStyleId?: string;
  type: TokenKind;
  value: unknown;
  codeTokenName?: string;
  codeTokenPath?: string;
  confidence?: number;
  usageCount: number;
}

// ---------- Assets -----------------------------------------------------------

export interface AssetRef {
  type: "icon" | "image" | "vector";
  name: string;
  path: string; // virtual reference such as @icons/search.svg
  figmaNodeId: string;
  base64?: string; // raw bytes for VS Code to write to disk
  format: "svg" | "png";
}

// ---------- Compressed spec sent to VS Code ---------------------------------

export type SpecNode =
  | ComponentRefSpec
  | LayoutSpec
  | TextSpec
  | AssetRefSpec;

export interface ComponentRefSpec {
  type: "component_ref";
  figmaName: string;
  figmaNodeId: string;
  codeComponent: string;
  codeFilePath: string;
  importType: "default" | "named";
  importName?: string;
  props: Record<string, unknown>;
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
  figmaNodeId: string;
}

export interface MappingReport {
  matched: number;
  unmatched: number;
  ignored: number;
  totalInstances: number;
  tokenCoverage: number; // 0..1
  confidence: number; // 0..1 average over matched
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

// ---------- UI ↔ main runtime messages --------------------------------------

export type UiToMain =
  | { type: "INIT" }
  | { type: "SCAN_SELECTION" }
  | { type: "AUTOFILL_MAPPINGS" }
  | { type: "BUILD_SPEC" }
  | { type: "GET_MAPPINGS" }
  | { type: "SAVE_MAPPING"; mapping: ComponentMapping }
  | { type: "DELETE_MAPPING"; id: string }
  | { type: "SET_CATALOGS"; components?: FEComponentCatalogItem[]; tokens?: FETokenCatalogItem[] }
  | { type: "SET_NODE_MARK"; nodeId: string; mark: AssetMark }
  | { type: "ZOOM_TO_NODE"; nodeId: string; preserveSelection?: boolean }
  | { type: "CREATE_COMPONENT_FROM_NODE"; nodeId: string }
  | { type: "ZOOM_TO_SELECTION" }
  | { type: "EXPAND_SELECTION" }
  | { type: "GET_FIGMA_COMPONENTS" }
  | { type: "CLOSE_PLUGIN" };

export type MainToUi =
  | {
      type: "INITIAL_STATE";
      mappings: ComponentMapping[];
      hasValidSelection: boolean;
      selection: { id: string; name: string; type: string } | null;
      catalogs: {
        components: FEComponentCatalogItem[];
        tokens: FETokenCatalogItem[];
      };
    }
  | {
      type: "SELECTION_STATE";
      hasValidSelection: boolean;
      selection: { id: string; name: string; type: string } | null;
    }
  | { type: "MAPPINGS_UPDATED"; mappings: ComponentMapping[] }
  | {
      type: "SCAN_RESULT";
      summary: {
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
          mainComponentKey?: string;
        }>;
      };
    }
  | {
      type: "AUTOFILL_RESULT";
      suggestions: AutofillSuggestion[];
    }
  | {
      type: "SPEC_READY";
      spec: CompressedSpec;
      spex: SpexBundleInfo;
    }
  | { type: "FIGMA_COMPONENTS"; names: string[] }
  | { type: "ERROR"; error: string }
  | { type: "PROGRESS"; stage: string };

export interface SpexBundleInfo {
  rootSlug: string;
  manifest: {
    version: string;
    exportDate: string;
    files: string[];
  };
  files: Record<string, { kind: "text"; content: string } | { kind: "binary"; base64: string }>;
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

export type VsCodeDesignSpecPayload = CompressedSpec & {
  spex: SpexBundleInfo;
};

export interface SelectionTreeNode {
  id: string;
  name: string;
  type: string;
  isInstance: boolean;
  matched: boolean; // INSTANCE has a component mapping
  mappingName?: string;
  figmaComponentKey?: string;
  figmaComponentName?: string;
  codeComponent?: string;
  codeFilePath?: string;
  importType?: "default" | "named";
  importName?: string;
  children?: SelectionTreeNode[];
}

export interface ReviewComponent {
  nodeId: string;
  name: string;
  type: string; // FRAME / INSTANCE / COMPONENT …
  codeComponent: string | null;
  codeFilePath: string | null;
}

export interface AutofillSuggestion {
  figmaName: string;
  figmaNodeId: string;
  figmaComponentKey?: string;
  candidates: Array<{
    codeComponent: string;
    codeFilePath: string;
    confidence: number;
    reason: string;
  }>;
}

// ---------- WebSocket protocol (Figma ↔ VS Code) ----------------------------

export type WsOut =
  | {
      type: "HELLO_FROM_FIGMA";
      pluginName: string;
      version: string;
      figmaFileName: string;
      figmaPageName: string;
    }
  | { type: "REQUEST_CATALOG"; requestId: string }
  | { type: "SEND_DESIGN_SPEC"; requestId: string; payload: VsCodeDesignSpecPayload }
  | { type: "SAVE_MAPPING"; mapping: ComponentMapping }
  | {
      type: "VALIDATE_MAPPING";
      requestId: string;
      mapping: ComponentMapping;
    };

export type WsIn =
  | {
      type: "HELLO_FROM_VSCODE";
      projectName: string;
      framework?: string;
      componentCatalogAvailable: boolean;
      tokenCatalogAvailable: boolean;
    }
  | {
      type: "COMPONENT_CATALOG";
      requestId?: string;
      items: FEComponentCatalogItem[];
    }
  | {
      type: "TOKEN_CATALOG";
      requestId?: string;
      tokens: FETokenCatalogItem[];
    }
  | {
      type: "MAPPING_SUGGESTIONS";
      requestId?: string;
      suggestions: AutofillSuggestion[];
    }
  | {
      type: "SPEC_RECEIVED";
      requestId: string;
      ok: boolean;
      message?: string;
    };
