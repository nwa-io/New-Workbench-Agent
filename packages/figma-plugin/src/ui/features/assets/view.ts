import type { CompressedSpec } from "../../../shared/types";
import { $ } from "../../dom/$";
import { el } from "../../dom/el";
import { badge } from "../../helpers/badge";
import { send } from "../../postbox";

const assetList = $<HTMLDivElement>("asset-list");

export function setAssetInfo(text: string): void {
  ($("asset-info") as HTMLDivElement).textContent = text;
}

export function renderAssets(spec: CompressedSpec): void {
  assetList.innerHTML = "";
  if (!spec.assets.length) {
    assetList.append(
      el(
        "div",
        { class: "empty" },
        "No assets exported. Mark a node as Icon/Image/Vector and rebuild."
      )
    );
    return;
  }
  for (const a of spec.assets) {
    assetList.append(
      el(
        "div",
        { class: "card" },
        el("div", { class: "card-title" }, a.name, " ", badge(a.type, "ok")),
        el(
          "div",
          { class: "card-sub" },
          `path: ${a.filePath} · format: ${a.format} · node: ${a.figmaNodeId}`
        ),
        el(
          "div",
          { class: "row", style: "margin-top:6px" },
          el(
            "button",
            {
              class: "btn btn-tiny btn-secondary auto",
              onclick: () =>
                send({ type: "ZOOM_TO_NODE", nodeId: a.figmaNodeId }),
            },
            "Locate"
          )
        )
      )
    );
  }
}
