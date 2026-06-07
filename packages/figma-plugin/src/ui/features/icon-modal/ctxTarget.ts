import type { SelectionTreeNode } from "../../../shared/types";

// The tree node that owns the currently-open context menu / modal. Captured
// when the user right-clicks a row so subsequent menu / modal actions know
// which Figma node to address.
export const ctxTarget: { node: SelectionTreeNode | null } = { node: null };

export function slugifyForIconName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
