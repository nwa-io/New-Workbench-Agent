import type {
  ComponentMapping,
  SelectionTreeNode,
} from "../../../shared/types";
import { normaliseUiName } from "../../helpers/prettyType";
import { state } from "../../state";
import { mergeMappings } from "./identity";

export function getActiveMappings(): ComponentMapping[] {
  return mergeMappings(state.mappings, state.projectMappings);
}

export function treeNodeMappingName(node: SelectionTreeNode): string {
  return node.mappingName || node.figmaComponentName || node.name;
}

export function findMappingForTreeNode(
  node: SelectionTreeNode
): ComponentMapping | null {
  const mappings = getActiveMappings();
  const byNodeId = mappings.find((m) => m.figmaNodeId === node.id);
  if (byNodeId) return byNodeId;
  if (node.figmaComponentKey) {
    const byKey = mappings.find(
      (m) => m.figmaComponentKey === node.figmaComponentKey
    );
    if (byKey) return byKey;
  }
  const mappingName = treeNodeMappingName(node);
  const exact = mappings.find((m) => m.figmaName === mappingName);
  if (exact) return exact;
  const normalized = normaliseUiName(mappingName);
  return (
    mappings.find((m) => normaliseUiName(m.figmaName) === normalized) ?? null
  );
}
