export type TokenKind =
  | "color"
  | "spacing"
  | "typography"
  | "radius"
  | "shadow"
  | "opacity"
  | "other";

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
