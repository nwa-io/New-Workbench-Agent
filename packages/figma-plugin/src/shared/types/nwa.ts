export interface NwaBundleInfo {
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
