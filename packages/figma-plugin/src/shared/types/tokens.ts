import type { TokenKind } from "./catalogs";

export interface DesignTokenRef {
  figmaTokenName: string;
  figmaVariableId?: string;
  figmaStyleId?: string;
  type: TokenKind;
  value: unknown;
  codeTokenName?: string;
  codeTokenPath?: string;
  confidence?: number;
  usageCount: number;
}
