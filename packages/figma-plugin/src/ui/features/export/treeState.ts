import type { SelectionTreeNode } from "../../../shared/types";

// Shared selection-tree state. tree.ts mutates lastSelectionTree / activeTreeNode
// on render; nodePanel.ts reads activeTreeNode for re-renders triggered by
// catalog updates. Kept in a tiny module to avoid a circular import between
// tree.ts and nodePanel.ts.
export const treeState: {
  lastSelectionTree: SelectionTreeNode | null;
  activeTreeNode: SelectionTreeNode | null;
} = {
  lastSelectionTree: null,
  activeTreeNode: null,
};

export function findTreeNodeById(
  node: SelectionTreeNode,
  nodeId: string
): SelectionTreeNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children ?? []) {
    const hit = findTreeNodeById(child, nodeId);
    if (hit) return hit;
  }
  return null;
}
