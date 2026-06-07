import type { ComponentMapping } from "../../../shared/types";
import { normaliseUiName } from "../../helpers/prettyType";

export function mappingIdentityMatches(
  a: ComponentMapping,
  b: ComponentMapping
): boolean {
  return (
    a.id === b.id ||
    (!!a.figmaComponentKey && a.figmaComponentKey === b.figmaComponentKey) ||
    (!!a.figmaNodeId && a.figmaNodeId === b.figmaNodeId) ||
    normaliseUiName(a.figmaName) === normaliseUiName(b.figmaName)
  );
}

export function mergeMappings(
  localMappings: ReadonlyArray<ComponentMapping>,
  projectMappings: ReadonlyArray<ComponentMapping>
): ComponentMapping[] {
  const merged = [...localMappings];
  for (const projectMapping of projectMappings) {
    const idx = merged.findIndex((localMapping) =>
      mappingIdentityMatches(localMapping, projectMapping)
    );
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        ...projectMapping,
      };
    } else {
      merged.push(projectMapping);
    }
  }
  return merged;
}
