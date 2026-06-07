import type { AssetMark } from "../../../shared/types";
import { send } from "../../postbox";
import { state } from "../../state";
import { setAssetInfo } from "./view";

export function initAssets(): void {
  document
    .querySelectorAll<HTMLButtonElement>("#panel-assets [data-mark]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.selection) return;
        const m = btn.dataset.mark;
        const mark: AssetMark = m === "clear" ? null : (m as AssetMark);
        send({ type: "SET_NODE_MARK", nodeId: state.selection.id, mark });
        setAssetInfo(
          mark
            ? `Marked "${state.selection.name}" as ${mark}.`
            : `Cleared mark on "${state.selection.name}".`
        );
      });
    });
}
