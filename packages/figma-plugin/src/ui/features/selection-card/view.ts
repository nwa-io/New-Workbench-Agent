import { send } from "../../postbox";
import { prettyType } from "../../helpers/prettyType";
import { state, type AppState } from "../../state";
import {
  reviewExportBtn,
  updateExportButtons,
} from "../export/elements";
import { closeReviewView } from "../export/review";
import { setLastReviewComponents } from "../export/reviewRows";
import { renderSelectionTree } from "../export/tree";
import { renderUnmatched } from "../export/unmatched";
import {
  expandBtn,
  iconCheck,
  iconEmpty,
  selectionIcon,
  selectionName,
  selectionSub,
  zoomBtn,
} from "./elements";

export function renderSelection(sel: AppState["selection"]): void {
  const prevId = state.selection?.id;
  state.selection = sel;
  if (sel) {
    selectionName.textContent = sel.name;
    selectionSub.textContent = `${prettyType(sel.type)} selected for export`;
    selectionIcon.classList.remove("empty");
    iconCheck.style.display = "";
    iconEmpty.style.display = "none";
    zoomBtn.disabled = false;
    expandBtn.disabled = false;
  } else {
    selectionName.textContent = "No selection";
    selectionSub.textContent =
      "Select a frame / component / instance / section / group";
    selectionIcon.classList.add("empty");
    iconCheck.style.display = "none";
    iconEmpty.style.display = "";
    zoomBtn.disabled = true;
    expandBtn.disabled = true;
  }
  updateExportButtons();

  // Selection changed: drop stale review data and auto-scan the new node so
  // the Export tab tree is always current.
  if (sel?.id !== prevId) {
    closeReviewView();
    if (sel) {
      send({ type: "SCAN_SELECTION" });
    } else {
      setLastReviewComponents([]);
      renderSelectionTree(null);
      renderUnmatched([]);
      reviewExportBtn.disabled = true;
    }
  }
}
