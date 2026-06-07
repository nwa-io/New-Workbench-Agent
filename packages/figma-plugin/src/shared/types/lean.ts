import type { ComponentContentText } from "./spec";

export type LeanNode =
  | LeanComponent
  | LeanLayout
  | LeanText
  | LeanAsset;

export interface LeanContent {
  texts?: ComponentContentText[];
  components?: LeanNode[];
  truncated?: boolean;
}

export interface LeanComponent {
  codeComponent: string;
  codeFilePath: string;
  importType?: "default" | "named";
  importName?: string;
  content?: LeanContent;
  children?: LeanNode[];
}

export interface LeanLayout {
  layout: string;
  styles?: Record<string, unknown>;
  text?: string;
  children?: LeanNode[];
}

export interface LeanText {
  text: string;
  typography?: string;
}

export interface LeanAsset {
  asset: "icon" | "image" | "vector";
  path: string;
  name?: string;
  figmaType?: string;
}

export interface LeanSpec {
  version: string;
  createdAt: string;
  figma: {
    fileName: string;
    pageName: string;
    selectedNodeName: string;
  };
  screen: {
    name: string;
    width: number;
    height: number;
    children: LeanNode[];
  };
  componentsUsed: Array<{
    codeComponent: string;
    codeFilePath: string;
    importType: "default" | "named";
    importName?: string;
    occurrences: number;
  }>;
  tokens: Array<{
    name: string;
    type: string;
    codeTokenName?: string;
    codeTokenPath?: string;
    usageCount: number;
  }>;
  assets: Array<{
    type: "icon" | "image" | "vector";
    name: string;
    path: string;
    filePath: string;
    format: "svg" | "png";
  }>;
  stats: {
    totalInstances: number;
    matched: number;
    unmatched: number;
    confidence: number;
    tokenCoverage: number;
  };
}
