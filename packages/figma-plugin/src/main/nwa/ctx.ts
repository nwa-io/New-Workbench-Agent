import type { ComponentMapping } from "../../shared/types";

export type NwaFile =
  | { kind: "text"; content: string }
  | { kind: "binary"; base64: string };

export interface NwaBundle {
  rootSlug: string;
  manifest: {
    version: string;
    exportDate: string;
    files: string[];
  };
  files: Record<string, NwaFile>;
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

export interface NwaCtx {
  mappings: ReadonlyArray<ComponentMapping>;

  fills: Map<string, { id: string; entry: Record<string, unknown> }>;
  strokes: Map<string, { id: string; entry: Record<string, unknown> }>;
  effects: Map<string, { id: string; entry: Record<string, unknown> }>;
  typography: Map<string, { id: string; entry: Record<string, unknown> }>;

  components: Map<string, { slug: string; payload: Record<string, unknown> }>;

  icons: Map<string, Uint8Array>;
  iconNodeIds: Set<string>;

  nodeCount: number;
  matchedCount: number;
}

export function createCtx(mappings: ReadonlyArray<ComponentMapping>): NwaCtx {
  return {
    mappings,
    fills: new Map(),
    strokes: new Map(),
    effects: new Map(),
    typography: new Map(),
    components: new Map(),
    icons: new Map(),
    iconNodeIds: new Set(),
    nodeCount: 0,
    matchedCount: 0,
  };
}

export const NWA_VERSION = "1.0";
