import type {
  ComponentMapping,
  FEComponentCatalogItem,
} from "../../shared/types";
import { normaliseName } from "../../shared/util/normaliseName";
import { bestCatalogMatch } from "./catalog";

export interface MatchInput {
  figmaName: string;
  figmaNodeId?: string;
  figmaComponentKey?: string;
  // When set, the node has been previously tagged with a confirmed mapping id.
  // Takes precedence over every other priority (P0).
  stickyMappingId?: string;
}

export interface MatchResult {
  mapping: ComponentMapping;
  confidence: number;
  reason: string;
}

// Distinguishes a confirmed (user-saved) match from a P5 catalog suggestion.
// P5 builds a synthetic mapping on the fly with id "auto:<componentName>";
// every saved mapping uses a different id format (manual "m_*", auto-fill
// "auto_*", project-mappings carry whatever id VS Code generated).
export function isSavedMatch(m: MatchResult | null): m is MatchResult {
  return !!m && !m.mapping.id.startsWith("auto:");
}

export function matchMapping(
  input: MatchInput,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>
): MatchResult | null {
  // P0: sticky tag written onto the node when the user confirmed a mapping
  if (input.stickyMappingId) {
    const hit = mappings.find((m) => m.id === input.stickyMappingId);
    if (hit) {
      return { mapping: hit, confidence: 1, reason: "sticky-tag" };
    }
  }

  // P1: exact figmaNodeId
  if (input.figmaNodeId) {
    const hit = mappings.find((m) => m.figmaNodeId === input.figmaNodeId);
    if (hit) {
      return {
        mapping: hit,
        confidence: hit.confidence || 1,
        reason: "node-id-match",
      };
    }
  }

  // P2: exact figmaComponentKey
  if (input.figmaComponentKey) {
    const hit = mappings.find(
      (m) => m.figmaComponentKey === input.figmaComponentKey
    );
    if (hit) {
      return {
        mapping: hit,
        confidence: hit.confidence || 1,
        reason: "key-match",
      };
    }
  }

  // P3: exact figmaName
  const exact = mappings.find((m) => m.figmaName === input.figmaName);
  if (exact) {
    return {
      mapping: exact,
      confidence: exact.confidence || 0.95,
      reason: "name-exact",
    };
  }

  // P4: normalised name match (case + separators ignored)
  const norm = normaliseName(input.figmaName);
  const normHit = mappings.find((m) => normaliseName(m.figmaName) === norm);
  if (normHit) {
    return {
      mapping: normHit,
      confidence: Math.max(0.8, normHit.confidence ?? 0),
      reason: "name-normalised",
    };
  }

  // P5: catalog-derived synthetic mapping (auto-suggested, name-based)
  const catalogHit = bestCatalogMatch(input.figmaName, components);
  if (catalogHit) {
    const synthetic: ComponentMapping = {
      id: `auto:${catalogHit.item.componentName}`,
      figmaName: input.figmaName,
      figmaComponentKey: input.figmaComponentKey,
      codeComponent: catalogHit.item.componentName,
      codeFilePath: catalogHit.item.filePath,
      importType: catalogHit.item.exportType,
      importName: catalogHit.item.componentName,
      confidence: catalogHit.score,
      source: "auto-suggested",
      updatedAt: new Date().toISOString(),
    };
    return {
      mapping: synthetic,
      confidence: catalogHit.score,
      reason: catalogHit.reason,
    };
  }

  return null;
}
