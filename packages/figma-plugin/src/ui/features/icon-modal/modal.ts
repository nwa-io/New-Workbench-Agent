import type { SelectionTreeNode } from "../../../shared/types";
import { ctxTarget, slugifyForIconName } from "./ctxTarget";
import {
  iconModalConfirmLabel,
  iconModalEl,
  iconModalNameInput,
  iconModalNodeNameEl,
  iconModalPathInput,
  iconModalTitleEl,
  iconModalUnmarkBtn,
} from "./elements";

export function openIconModal(node: SelectionTreeNode): void {
  ctxTarget.node = node;
  iconModalNodeNameEl.textContent = node.name;
  iconModalNodeNameEl.title = node.name;

  const isAlreadyMarked = node.assetMark === "icon";
  const defaultName =
    node.assetIconName || slugifyForIconName(node.name) || "icon";
  iconModalNameInput.value = defaultName;
  iconModalPathInput.value =
    node.assetExportPath || `icons/${defaultName}.svg`;

  // When the node already carries an icon mark, switch the modal into
  // "edit" mode: title changes, primary button becomes "Update", and the
  // Unmark button is exposed.
  iconModalTitleEl.textContent = isAlreadyMarked ? "Edit Icon Mark" : "Mark as Icon";
  iconModalConfirmLabel.textContent = isAlreadyMarked
    ? "Update Icon"
    : "Mark as Icon";
  iconModalUnmarkBtn.hidden = !isAlreadyMarked;

  iconModalEl.hidden = false;
  window.setTimeout(() => iconModalNameInput.focus(), 0);
}

export function closeIconModal(): void {
  iconModalEl.hidden = true;
}
