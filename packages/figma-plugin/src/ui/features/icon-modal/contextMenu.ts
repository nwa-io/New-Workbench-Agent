import type { SelectionTreeNode } from "../../../shared/types";
import { ctxTarget } from "./ctxTarget";
import { treeContextMenuEl } from "./elements";

export function openTreeContextMenu(
  x: number,
  y: number,
  node: SelectionTreeNode
): void {
  ctxTarget.node = node;
  treeContextMenuEl.hidden = false;
  // Position relative to the viewport. Clamp so the menu never overflows
  // the right / bottom edge — measured after first making it visible so
  // offsetWidth / offsetHeight are accurate.
  const menuW = treeContextMenuEl.offsetWidth;
  const menuH = treeContextMenuEl.offsetHeight;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);
  treeContextMenuEl.style.left = `${Math.max(8, left)}px`;
  treeContextMenuEl.style.top = `${Math.max(8, top)}px`;

  // Reflect the node's current mark in the menu so the icon row reads
  // "Update Icon Mark" / "Mark as Icon" depending on state.
  const iconItem = treeContextMenuEl.querySelector<HTMLDivElement>(
    '[data-mark-action="icon"] span'
  );
  if (iconItem) {
    iconItem.textContent =
      node.assetMark === "icon" ? "Edit Icon Mark…" : "Mark as Icon…";
  }
}

export function closeTreeContextMenu(): void {
  if (!treeContextMenuEl.hidden) {
    treeContextMenuEl.hidden = true;
  }
}
