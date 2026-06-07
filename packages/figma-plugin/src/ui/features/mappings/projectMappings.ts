import type {
  AutofillSuggestion,
  ComponentMapping,
} from "../../../shared/types";
import { send } from "../../postbox";
import { state } from "../../state";
import { mergeMappings } from "./identity";

// Pulls project-level mappings (from .project/figma-bridge in VS Code) into
// the plugin's local clientStorage so future scans / autofills see them
// without an extra round-trip. We only insert mappings that are not already
// represented locally (by id, figmaComponentKey, or figmaName).
export function mergeProjectMappingsIntoLocal(
  projectMappings: ComponentMapping[]
): void {
  state.mappings = mergeMappings(state.mappings, projectMappings);
  for (const projectMapping of projectMappings) {
    send({ type: "SAVE_MAPPING", mapping: projectMapping });
  }
}

export function findInProjectMappings(
  s: AutofillSuggestion
): ComponentMapping | undefined {
  return state.projectMappings.find(
    (pm) =>
      (pm.figmaComponentKey &&
        pm.figmaComponentKey === s.figmaComponentKey) ||
      pm.figmaName === s.figmaName
  );
}
