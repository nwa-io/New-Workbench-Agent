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

  propMapping?: Record<string, string>;
  defaultProps?: Record<string, unknown>;
  mergeChildProps?: boolean;

  confidence: number;
  source: "manual" | "auto-suggested" | "confirmed";
  updatedAt: string;

  previewUiUrl?: string;
  description?: string;
}
