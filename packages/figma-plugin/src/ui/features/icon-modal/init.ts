import { send } from "../../postbox";
import { closeTreeContextMenu } from "./contextMenu";
import { ctxTarget, slugifyForIconName } from "./ctxTarget";
import {
  iconModalCancelBtn,
  iconModalCloseBtn,
  iconModalConfirmBtn,
  iconModalEl,
  iconModalNameInput,
  iconModalPathInput,
  iconModalUnmarkBtn,
  treeContextMenuEl,
} from "./elements";
import { closeIconModal, openIconModal } from "./modal";

export function initIconModal(): void {
  // Wire up the context-menu items. Disabled rows do nothing; the icon row
  // closes the menu and opens the Mark-as-Icon modal for the captured node.
  treeContextMenuEl.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLDivElement>(".ctx-item");
    if (!item || item.classList.contains("disabled")) return;
    const action = item.dataset.markAction;
    if (action === "icon" && ctxTarget.node) {
      openIconModal(ctxTarget.node);
    }
    closeTreeContextMenu();
  });

  // Click anywhere outside the menu (or pressing Escape) dismisses it.
  window.addEventListener("click", (e) => {
    if (treeContextMenuEl.hidden) return;
    if (!treeContextMenuEl.contains(e.target as Node)) closeTreeContextMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeTreeContextMenu();
      if (!iconModalEl.hidden) closeIconModal();
    }
  });

  // Keep Export Path in sync with Icon Name while the user types, but only
  // when the path still matches the previous derived value — that way a user
  // who deliberately customised the path doesn't have their input overwritten.
  iconModalNameInput.addEventListener("input", () => {
    const cleaned = slugifyForIconName(iconModalNameInput.value);
    const expectedPath = `icons/${cleaned || "icon"}.svg`;
    const currentPath = iconModalPathInput.value.trim();
    const looksDerived =
      !currentPath || /^icons\/[^/]+\.svg$/.test(currentPath);
    if (looksDerived) iconModalPathInput.value = expectedPath;
  });

  iconModalCancelBtn.addEventListener("click", closeIconModal);
  iconModalCloseBtn.addEventListener("click", closeIconModal);
  iconModalEl.addEventListener("click", (e) => {
    if (e.target === iconModalEl) closeIconModal();
  });

  iconModalConfirmBtn.addEventListener("click", () => {
    if (!ctxTarget.node) return;
    const rawName = iconModalNameInput.value.trim();
    const iconName = slugifyForIconName(rawName);
    if (!iconName) {
      iconModalNameInput.focus();
      return;
    }
    const exportPath =
      iconModalPathInput.value.trim() || `icons/${iconName}.svg`;
    send({
      type: "SET_NODE_MARK",
      nodeId: ctxTarget.node.id,
      mark: "icon",
      iconName,
      exportPath,
    });
    // Update the cached tree node so a follow-up right-click reflects the
    // new state without waiting for a fresh scan.
    ctxTarget.node.assetMark = "icon";
    ctxTarget.node.assetIconName = iconName;
    ctxTarget.node.assetExportPath = exportPath;
    closeIconModal();
  });

  iconModalUnmarkBtn.addEventListener("click", () => {
    if (!ctxTarget.node) return;
    send({
      type: "SET_NODE_MARK",
      nodeId: ctxTarget.node.id,
      mark: null,
    });
    ctxTarget.node.assetMark = undefined;
    ctxTarget.node.assetIconName = undefined;
    ctxTarget.node.assetExportPath = undefined;
    closeIconModal();
  });
}
