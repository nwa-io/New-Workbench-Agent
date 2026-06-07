import type { ComponentMapping } from "../../../shared/types";
import { el } from "../../dom/el";
import { iconSvg } from "../../dom/icons";
import { send } from "../../postbox";
import { state } from "../../state";
import { wsSend, isSocketOpen } from "../connection/socket";
import {
  recordsCountEl,
  recordsEmptyState,
  recordsExportCountEl,
  recordsFooterCountEl,
  recordsListWrap,
  recordsProjectName,
} from "./elements";
import { openRecordModal } from "./modal";

let recordsSearch = "";

export function setRecordsSearch(value: string): void {
  recordsSearch = value;
  renderRecords();
}

export function renderRecords(): void {
  recordsProjectName.textContent = state.ws.handshake?.projectName ?? "Local";

  const filtered = filterRecords(state.mappings, recordsSearch);

  recordsCountEl.textContent = String(state.mappings.length);
  recordsExportCountEl.textContent = String(state.mappings.length);
  recordsFooterCountEl.textContent = recordsSearch
    ? `${filtered.length} of ${state.mappings.length} records`
    : `${state.mappings.length} record${state.mappings.length === 1 ? "" : "s"} total`;

  // Empty state when there are no records at all (not just filtered out).
  const showEmpty = state.mappings.length === 0;
  recordsEmptyState.hidden = !showEmpty;
  recordsListWrap.style.display = showEmpty ? "none" : "flex";

  recordsListWrap.innerHTML = "";

  if (!showEmpty && filtered.length === 0) {
    recordsListWrap.append(
      el("div", { class: "empty" }, `No records match "${recordsSearch}".`)
    );
    return;
  }

  for (const m of filtered) {
    recordsListWrap.append(renderRecordCard(m));
  }
}

function filterRecords(
  list: ComponentMapping[],
  q: string
): ComponentMapping[] {
  if (!q)
    return list
      .slice()
      .sort((a, b) => a.codeComponent.localeCompare(b.codeComponent));
  const matches = list.filter(
    (m) =>
      m.codeComponent.toLowerCase().includes(q) ||
      m.figmaName.toLowerCase().includes(q) ||
      (m.codeFilePath ?? "").toLowerCase().includes(q)
  );
  matches.sort((a, b) => a.codeComponent.localeCompare(b.codeComponent));
  return matches;
}

function renderRecordCard(m: ComponentMapping): HTMLDivElement {
  const initials =
    (m.codeComponent || m.figmaName || "?")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";

  return el(
    "div",
    { class: "record-card" },
    el("div", { class: "record-card-avatar" }, initials),
    el(
      "div",
      { class: "record-card-body" },
      el(
        "div",
        { class: "record-card-name" },
        m.codeComponent || "(no code component)"
      ),
      el("div", { class: "record-card-figma" }, m.figmaName || "(no figma name)"),
      el(
        "div",
        { class: "record-card-path", title: m.codeFilePath },
        m.codeFilePath || "(no file path)"
      )
    ),
    el(
      "div",
      { class: "record-card-actions" },
      ...(m.previewUiUrl
        ? [
            el(
              "a",
              {
                class: "record-action",
                href: m.previewUiUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                title: "Open preview UI",
              },
              iconSvg("M5 11l6-6M11 5h-4M11 5v4", 13)
            ),
          ]
        : []),
      el(
        "button",
        {
          class: "record-action",
          title: "Edit record",
          onclick: () => openRecordModal(m),
        },
        iconSvg("M2.5 13.5l3-.5L13.5 5l-2.5-2.5L3 10.5l-.5 3z", 13)
      ),
      el(
        "button",
        {
          class: "record-action danger",
          title: "Delete record",
          onclick: () => {
            // eslint-disable-next-line no-alert
            if (confirm(`Delete "${m.codeComponent || m.figmaName}"?`)) {
              send({ type: "DELETE_MAPPING", id: m.id });
              if (isSocketOpen()) {
                wsSend({ type: "DELETE_MAPPING", id: m.id });
              }
            }
          },
        },
        iconSvg(
          "M3 5h10M5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M4.5 5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1L11.5 5",
          13
        )
      )
    )
  ) as HTMLDivElement;
}
