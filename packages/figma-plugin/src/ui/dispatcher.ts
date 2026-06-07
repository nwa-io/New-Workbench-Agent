import type { MainToUi } from "../shared/types";
import { connect } from "./features/connection/reconnect";
import { renderCatalogInfo } from "./features/connection/status";
import { renderAssets } from "./features/assets/view";
import { handleAutofill } from "./features/autofill/handler";
import {
  exportActionState,
  pendingState,
} from "./features/export/exportAction";
import { reviewExportBtn, updateExportButtons } from "./features/export/elements";
import { downloadNwaAsZip, downloadVsCodePayloadAsJson } from "./features/export/download";
import { openReviewView, isReviewOpen } from "./features/export/review";
import { setLastReviewComponents } from "./features/export/reviewRows";
import { sendNwaToVsCode } from "./features/export/send";
import { setExportStatus, setReviewStatus } from "./features/export/status";
import { renderSelectionTree } from "./features/export/tree";
import { treeState } from "./features/export/treeState";
import { renderUnmatched } from "./features/export/unmatched";
import { mergeMappings } from "./features/mappings/identity";
import { renderRecords } from "./features/records-manager/list";
import { setFigmaComponentNames } from "./features/records-manager/nameCombo";
import { renderReport } from "./features/report/view";
import { renderSelection } from "./features/selection-card/view";
import { renderTokens } from "./features/tokens/view";
import { state } from "./state";

export function initDispatcher(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    const msg = (event.data && event.data.pluginMessage) as
      | MainToUi
      | undefined;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "INITIAL_STATE":
        state.mappings = msg.mappings;
        state.catalogs = msg.catalogs;
        renderSelection(msg.hasValidSelection ? msg.selection : null);
        renderRecords();
        renderCatalogInfo();
        // Open WebSocket on startup.
        connect();
        return;

      case "SELECTION_STATE":
        renderSelection(msg.hasValidSelection ? msg.selection : null);
        return;

      case "MAPPINGS_UPDATED":
        state.mappings = mergeMappings(msg.mappings, state.projectMappings);
        renderRecords();
        renderSelectionTree(treeState.lastSelectionTree);
        return;

      case "SCAN_RESULT":
        renderSelectionTree(msg.summary.tree);
        renderUnmatched(msg.summary.unmatchedInstances);
        renderTokens(msg.summary.tokens);
        setLastReviewComponents(msg.summary.reviewComponents);
        reviewExportBtn.disabled = false;
        setExportStatus(
          `Scanned ${msg.summary.nodes} nodes · ${msg.summary.instances} instances · ` +
            `${msg.summary.unmatchedInstances.length} unmatched · ` +
            `${msg.summary.tokens.length} tokens.`,
          msg.summary.unmatchedInstances.length === 0 ? "ok" : "warn"
        );
        if (pendingState.openReview) {
          pendingState.openReview = false;
          openReviewView();
        }
        return;

      case "AUTOFILL_RESULT":
        handleAutofill(msg.suggestions);
        return;

      case "SPEC_READY": {
        state.lastSpec = msg.spec;
        state.lastLean = msg.lean;
        state.lastNwa = msg.nwa;
        updateExportButtons();
        renderTokens(msg.spec.tokens);
        renderAssets(msg.spec);
        renderReport(msg.spec);
        // Dispatch the pending export action triggered from the review page.
        const action = exportActionState.value;
        exportActionState.value = null;
        if (action === "send") {
          sendNwaToVsCode(setReviewStatus);
        } else if (action === "download") {
          void downloadNwaAsZip(msg.nwa, setReviewStatus);
        } else if (action === "download-json") {
          downloadVsCodePayloadAsJson(setReviewStatus);
        } else {
          setExportStatus(
            `Spec built: ${msg.nwa.stats.uniqueComponents} components, ` +
              `${msg.nwa.stats.icons} icons, ${msg.spec.tokens.length} tokens.`,
            "ok"
          );
        }
        return;
      }

      case "FIGMA_COMPONENTS":
        setFigmaComponentNames(msg.names);
        return;

      case "PROGRESS":
        if (isReviewOpen()) setReviewStatus(msg.stage, "info");
        else setExportStatus(msg.stage, "info");
        return;

      case "ERROR":
        if (isReviewOpen()) setReviewStatus(`Error: ${msg.error}`, "err");
        else setExportStatus(`Error: ${msg.error}`, "err");
        return;
    }
  });
}
