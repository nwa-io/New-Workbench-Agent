import type { AssetMark } from "./assets";
import type { ComponentMapping } from "./mappings";
import type { FEComponentCatalogItem, FETokenCatalogItem } from "./catalogs";
import type { CompressedSpec } from "./spec";
import type { LeanSpec } from "./lean";
import type { NwaBundleInfo } from "./nwa";
import type { DesignTokenRef } from "./tokens";
import type {
  AutofillSuggestion,
  ReviewComponent,
  SelectionTreeNode,
} from "./selection";

export type UiToMain =
  | { type: "INIT" }
  | { type: "SCAN_SELECTION" }
  | { type: "AUTOFILL_MAPPINGS" }
  | { type: "BUILD_SPEC" }
  | { type: "GET_MAPPINGS" }
  | { type: "SAVE_MAPPING"; mapping: ComponentMapping }
  | { type: "DELETE_MAPPING"; id: string }
  | {
      type: "SET_CATALOGS";
      components?: FEComponentCatalogItem[];
      tokens?: FETokenCatalogItem[];
    }
  | {
      type: "SET_NODE_MARK";
      nodeId: string;
      mark: AssetMark;
      iconName?: string;
      exportPath?: string;
    }
  | {
      type: "ZOOM_TO_NODE";
      nodeId: string;
      preserveSelection?: boolean;
      highlight?: boolean;
    }
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
          displayName: string;
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
      lean: LeanSpec;
      nwa: NwaBundleInfo;
    }
  | { type: "FIGMA_COMPONENTS"; names: string[] }
  | { type: "ERROR"; error: string }
  | { type: "PROGRESS"; stage: string };
