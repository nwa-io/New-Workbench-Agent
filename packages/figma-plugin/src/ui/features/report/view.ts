import type { CompressedSpec } from "../../../shared/types";
import { $ } from "../../dom/$";
import { el } from "../../dom/el";
import { badge } from "../../helpers/badge";
import { setCollapsibleSectionOpen } from "../../helpers/collapsible";
import { send } from "../../postbox";
import { openRecordModal } from "../records-manager/modal";

const reportUnmatchedListEl = $<HTMLDivElement>("rs-unmatched-list");
const reportUnmatchedCountEl = $<HTMLSpanElement>("rs-unmatched-count");
const reportUnmatchedToggleEl = $<HTMLButtonElement>("rs-unmatched-toggle");

export function setReportUnmatchedOpen(open: boolean): void {
  setCollapsibleSectionOpen(
    reportUnmatchedToggleEl,
    reportUnmatchedListEl,
    open
  );
}

export function getReportUnmatchedToggle(): HTMLButtonElement {
  return reportUnmatchedToggleEl;
}

export function getReportUnmatchedList(): HTMLDivElement {
  return reportUnmatchedListEl;
}

export function renderReport(spec: CompressedSpec): void {
  const r = spec.mappingReport;
  $("rs-matched").textContent = String(r.matched);
  $("rs-unmatched").textContent = String(r.unmatched);
  reportUnmatchedCountEl.textContent = String(r.unmatchedDetails.length);
  $("rs-confidence").textContent = `${(r.confidence * 100).toFixed(0)}%`;
  $("rs-token").textContent = `${(r.tokenCoverage * 100).toFixed(0)}%`;
  $("rs-assets").textContent = String(spec.assets.length);
  $("rs-tokens").textContent = String(spec.tokens.length);

  reportUnmatchedListEl.innerHTML = "";
  setReportUnmatchedOpen(false);
  if (!r.unmatchedDetails.length) {
    reportUnmatchedListEl.append(
      el("div", { class: "empty" }, "All instances are matched.")
    );
  } else {
    for (const u of r.unmatchedDetails) {
      reportUnmatchedListEl.append(
        el(
          "div",
          { class: "card" },
          el(
            "div",
            { class: "card-title" },
            u.figmaName,
            " ",
            badge(u.figmaType, "muted")
          ),
          el("div", { class: "card-sub" }, `node: ${u.nodeId}`),
          el(
            "div",
            { class: "row", style: "margin-top:6px" },
            el(
              "button",
              {
                class: "btn btn-tiny btn-secondary auto",
                onclick: () =>
                  send({ type: "ZOOM_TO_NODE", nodeId: u.nodeId }),
              },
              "Locate"
            ),
            el(
              "button",
              {
                class: "btn btn-tiny btn-secondary auto",
                onclick: () => {
                  openRecordModal({
                    id: `m_${Date.now()}`,
                    figmaName: u.figmaName,
                    codeComponent: "",
                    codeFilePath: "",
                    importType: "named",
                    confidence: 1,
                    source: "manual",
                    updatedAt: new Date().toISOString(),
                  });
                },
              },
              "Map →"
            )
          )
        )
      );
    }
  }

  const missingTokens = $<HTMLDivElement>("rs-missing-tokens");
  missingTokens.innerHTML = "";
  if (!r.missingTokens.length) {
    missingTokens.append(
      el("div", { class: "empty" }, "All used tokens have a code mapping.")
    );
  } else {
    for (const t of r.missingTokens) {
      missingTokens.append(
        el(
          "div",
          { class: "card" },
          el(
            "div",
            { class: "card-title" },
            t.figmaTokenName,
            " ",
            badge(t.type, "warn")
          )
        )
      );
    }
  }
}
