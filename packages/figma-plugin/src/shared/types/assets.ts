export type AssetMark =
  | "icon"
  | "image"
  | "vector"
  | "illustration"
  | "decorative"
  | "ignored"
  | null;

export interface AssetRef {
  type: "icon" | "image" | "vector";
  name: string;
  path: string;
  filePath: string;
  figmaNodeId: string;
  base64?: string;
  format: "svg" | "png";
}
