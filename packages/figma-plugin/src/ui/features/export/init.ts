import { wireCollapsibleToggle } from "../../helpers/collapsible";
import { send } from "../../postbox";
import {
  getReportUnmatchedList,
  getReportUnmatchedToggle,
} from "../report/view";
import {
  autofillBtn,
  doExportBtn,
  reviewBackBtn,
  reviewDownloadBtn,
  reviewDownloadJsonBtn,
  reviewExportBtn,
  unmatchedListEl,
  unmatchedToggleEl,
} from "./elements";
import { exportActionState, pendingState } from "./exportAction";
import { closeReviewView, openReviewView } from "./review";
import { reviewState } from "./reviewRows";
import { setExportStatus, setReviewStatus } from "./status";

export function initExport(): void {
  wireCollapsibleToggle(unmatchedToggleEl, unmatchedListEl);
  wireCollapsibleToggle(getReportUnmatchedToggle(), getReportUnmatchedList());

  autofillBtn.addEventListener("click", () =>
    send({ type: "AUTOFILL_MAPPINGS" })
  );

  reviewExportBtn.addEventListener("click", () => {
    if (!reviewState.lastReviewComponents.length) {
      // No scan yet — scan first; the SCAN_RESULT handler will open review.
      pendingState.openReview = true;
      send({ type: "SCAN_SELECTION" });
      setExportStatus("Scanning before review…");
      return;
    }
    openReviewView();
  });

  reviewBackBtn.addEventListener("click", () => closeReviewView());

  doExportBtn.addEventListener("click", () => {
    // Primary export: build the spec, then send to VS Code on SPEC_READY.
    exportActionState.value = "send";
    setReviewStatus("Building spec…");
    send({ type: "BUILD_SPEC" });
  });

  reviewDownloadBtn.addEventListener("click", () => {
    exportActionState.value = "download";
    setReviewStatus("Building spec…");
    send({ type: "BUILD_SPEC" });
  });

  reviewDownloadJsonBtn.addEventListener("click", () => {
    exportActionState.value = "download-json";
    setReviewStatus("Building spec...");
    send({ type: "BUILD_SPEC" });
  });
}
