import type { ComponentMapping } from "../../shared/types";
import { normaliseName } from "../../shared/util/normaliseName";

// Mapping lookup local to the nwa bundler. Simpler than the main matcher
// because the bundle doesn't need P5 catalog suggestions — it only enriches
// already-known instances with codeFilePath / codeComponent.
export function findMapping(
  mappings: ReadonlyArray<ComponentMapping>,
  figmaName: string,
  figmaComponentKey: string | undefined,
  figmaNodeId?: string
): ComponentMapping | undefined {
  if (figmaNodeId) {
    const hit = mappings.find((m) => m.figmaNodeId === figmaNodeId);
    if (hit) return hit;
  }
  if (figmaComponentKey) {
    const hit = mappings.find((m) => m.figmaComponentKey === figmaComponentKey);
    if (hit) return hit;
  }
  const exact = mappings.find((m) => m.figmaName === figmaName);
  if (exact) return exact;
  const norm = normaliseName(figmaName);
  return mappings.find((m) => normaliseName(m.figmaName) === norm);
}
