import type {
  ComponentMapping,
  CompressedSpec,
  FEComponentCatalogItem,
  FETokenCatalogItem,
  LeanSpec,
  NwaBundleInfo,
} from "../shared/types";

export interface AppState {
  selection: { id: string; name: string; type: string } | null;
  mappings: ComponentMapping[];
  // Project-level mappings sent by VS Code from `.project/figma-bridge/
  // component-mappings.json`. The Figma plugin keeps a local cache in
  // figma.clientStorage; this list is the project source of truth that
  // survives across users, machines, and Figma file copies.
  projectMappings: ComponentMapping[];
  catalogs: {
    components: FEComponentCatalogItem[];
    tokens: FETokenCatalogItem[];
  };
  lastSpec: CompressedSpec | null;
  lastLean: LeanSpec | null;
  lastNwa: NwaBundleInfo | null;
  lastUnmatched: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
    displayName?: string;
  }>;
  ws: {
    status: "offline" | "connecting" | "open" | "handshaken";
    handshake?: { projectName: string; framework?: string };
    lastSyncAt?: string;
  };
}

export const state: AppState = {
  selection: null,
  mappings: [],
  projectMappings: [],
  catalogs: { components: [], tokens: [] },
  lastSpec: null,
  lastLean: null,
  lastNwa: null,
  lastUnmatched: [],
  ws: { status: "offline" },
};
