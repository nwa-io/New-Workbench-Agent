import type { ComponentMapping } from "./mappings";
import type { FEComponentCatalogItem, FETokenCatalogItem } from "./catalogs";
import type { CompressedSpec } from "./spec";
import type { LeanSpec } from "./lean";
import type { NwaBundleInfo } from "./nwa";
import type { AutofillSuggestion } from "./selection";

export type VsCodeDesignSpecPayload = CompressedSpec & {
  nwa: NwaBundleInfo;
  lean: LeanSpec;
  componentMappings: ComponentMapping[];
};

export type WsOut =
  | {
      type: "HELLO_FROM_FIGMA";
      pluginName: string;
      version: string;
      figmaFileName: string;
      figmaPageName: string;
    }
  | { type: "REQUEST_CATALOG"; requestId: string }
  | { type: "REQUEST_PROJECT_MAPPINGS"; requestId: string }
  | { type: "SEND_DESIGN_SPEC"; requestId: string; payload: VsCodeDesignSpecPayload }
  | { type: "SAVE_MAPPING"; mapping: ComponentMapping }
  | { type: "DELETE_MAPPING"; id: string }
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
      projectMappings?: ComponentMapping[];
      projectMappingsCount?: number;
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
      type: "PROJECT_MAPPINGS";
      requestId?: string;
      mappings: ComponentMapping[];
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
