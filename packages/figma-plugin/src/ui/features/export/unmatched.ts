import { el } from "../../dom/el";
import {
  setCollapsibleSectionOpen,
} from "../../helpers/collapsible";
import { humanizeComponentTitle } from "../../helpers/prettyType";
import { send } from "../../postbox";
import { state } from "../../state";
import { openRecordModal } from "../records-manager/modal";
import {
  unmatchedCountEl,
  unmatchedListEl,
  unmatchedToggleEl,
} from "./elements";

export function setUnmatchedOpen(open: boolean): void {
  setCollapsibleSectionOpen(unmatchedToggleEl, unmatchedListEl, open);
}

export function renderUnmatched(
  unmatched: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
    displayName?: string;
  }>
): void {
  state.lastUnmatched = unmatched;
  unmatchedListEl.innerHTML = "";
  unmatchedCountEl.textContent = String(unmatched.length);
  setUnmatchedOpen(false);
  if (!unmatched.length) {
    unmatchedListEl.append(
      el("div", { class: "empty" }, "All instances are matched.")
    );
    return;
  }
  for (const u of unmatched) {
    // displayName carries the Component Set parent's name when the unmatched
    // component is a Figma variant, so "Type=Normal, Breakpoint=Desktop"
    // shows up as "Card header". Fall back to the older slash-formatting
    // path for older payloads / non-variant components.
    const cleanDisplay =
      u.displayName && !/=/.test(u.displayName) ? u.displayName : undefined;
    const title =
      cleanDisplay ?? humanizeComponentTitle(u.figmaName || u.name);
    const subtitle =
      u.figmaName && u.figmaName !== title ? u.figmaName : undefined;
    unmatchedListEl.append(
      el(
        "div",
        { class: "card" },
        el("div", { class: "card-title", title: u.figmaName }, title),
        ...(subtitle ? [el("div", { class: "card-sub" }, subtitle)] : []),
        el(
          "div",
          { class: "row", style: "margin-top:6px" },
          el(
            "button",
            {
              class: "btn btn-tiny btn-secondary auto",
              // preserveSelection keeps the user's original frame as the
              // selection so they can keep mapping inside it; Locate just
              // zooms to the unmatched node without re-rooting the selection.
              onclick: () =>
                send({
                  type: "ZOOM_TO_NODE",
                  nodeId: u.nodeId,
                  preserveSelection: true,
                }),
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
