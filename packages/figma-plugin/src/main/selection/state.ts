import { ALLOWED_SELECTION_TYPES } from "../../shared/constants";

export interface SelectionState {
  hasValidSelection: boolean;
  selection: { id: string; name: string; type: string } | null;
}

export function getSelectionState(): SelectionState {
  const node = figma.currentPage.selection[0];
  const isValid =
    !!node &&
    (ALLOWED_SELECTION_TYPES as ReadonlyArray<string>).includes(node.type);
  return {
    hasValidSelection: isValid,
    selection: node ? { id: node.id, name: node.name, type: node.type } : null,
  };
}

export function requireSelectedNode(): SceneNode {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    throw new Error(
      "Nothing is selected. Pick a frame, component, instance, section, or group."
    );
  }
  const node = sel[0];
  if (!(ALLOWED_SELECTION_TYPES as ReadonlyArray<string>).includes(node.type)) {
    throw new Error(
      `Selected node type "${node.type}" is not supported. ` +
        `Supported: ${ALLOWED_SELECTION_TYPES.join(", ")}.`
    );
  }
  return node;
}
