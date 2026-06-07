import type {
  AssetRef,
  ComponentMapping,
  DesignTokenRef,
  FEComponentCatalogItem,
  FETokenCatalogItem,
  MappingReport,
} from "../../shared/types";

export interface BuildCtx {
  mappings: ReadonlyArray<ComponentMapping>;
  components: ReadonlyArray<FEComponentCatalogItem>;
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>;
  localVars: Map<string, Variable>;

  tokens: Map<string, DesignTokenRef>;
  assets: AssetRef[];

  matched: number;
  unmatched: number;
  ignored: number;
  totalInstances: number;
  confidenceSum: number;
  matchedDetails: MappingReport["matchedDetails"];
  unmatchedDetails: MappingReport["unmatchedDetails"];
  componentsUsed: Map<
    string,
    {
      figmaName: string;
      codeComponent: string;
      codeFilePath: string;
      importType: "default" | "named";
      importName?: string;
      confidence: number;
      occurrences: number;
    }
  >;
}

export function isMappableContainer(type: string): boolean {
  return (
    type === "FRAME" ||
    type === "GROUP" ||
    type === "SECTION" ||
    type === "COMPONENT" ||
    type === "COMPONENT_SET"
  );
}

// Maximum number of text records emitted per matched component.
export const MAX_CONTENT_TEXTS = 200;
