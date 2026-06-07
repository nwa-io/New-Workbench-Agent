import { $ } from "../../dom/$";
import { state } from "../../state";

export const autofillBtn = $<HTMLButtonElement>("autofill-btn");
export const reviewExportBtn = $<HTMLButtonElement>("review-export-btn");
export const reviewBackBtn = $<HTMLButtonElement>("review-back-btn");
export const doExportBtn = $<HTMLButtonElement>("do-export-btn");
export const reviewDownloadBtn = $<HTMLButtonElement>("review-download-btn");
export const reviewDownloadJsonBtn = $<HTMLButtonElement>(
  "review-download-json-btn"
);
export const exportStatus = $<HTMLDivElement>("export-status");
export const reviewStatus = $<HTMLDivElement>("review-status");

export const exportMain = $<HTMLDivElement>("export-main");
export const exportReview = $<HTMLDivElement>("export-review");
export const exportWorkspaceEl = $<HTMLDivElement>("export-workspace");
export const selectionTreeEl = $<HTMLDivElement>("selection-tree");
export const treeNodePanelEl = $<HTMLDivElement>("tree-node-panel");
export const treeCountEl = $<HTMLSpanElement>("tree-count");
export const unmatchedListEl = $<HTMLDivElement>("unmatched-list");
export const unmatchedCountEl = $<HTMLSpanElement>("unmatched-count");
export const unmatchedToggleEl = $<HTMLButtonElement>("unmatched-toggle");

export const reviewRowsEl = $<HTMLDivElement>("review-rows");
export const exportCountEl = $<HTMLSpanElement>("export-count");

export function updateExportButtons(): void {
  const hasSel = !!state.selection;
  autofillBtn.disabled = !hasSel;
  reviewExportBtn.disabled = !hasSel;
  reviewDownloadBtn.disabled = !hasSel;
  reviewDownloadJsonBtn.disabled = !hasSel;
}
