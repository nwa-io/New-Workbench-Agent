import type { AssetMark } from "./assets";

export interface SelectionTreeNode {
  id: string;
  name: string;
  type: string;
  isInstance: boolean;
  matched: boolean;
  mappingName?: string;
  figmaComponentKey?: string;
  figmaComponentName?: string;
  codeComponent?: string;
  codeFilePath?: string;
  importType?: "default" | "named";
  importName?: string;
  assetMark?: AssetMark;
  assetIconName?: string;
  assetExportPath?: string;
  children?: SelectionTreeNode[];
}

export interface ReviewComponent {
  nodeId: string;
  name: string;
  type: string;
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
