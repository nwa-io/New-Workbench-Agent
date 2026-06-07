import { send } from "../../postbox";
import { expandBtn, zoomBtn } from "./elements";

export function initSelectionCard(): void {
  zoomBtn.addEventListener("click", () => send({ type: "ZOOM_TO_SELECTION" }));
  expandBtn.addEventListener("click", () => send({ type: "EXPAND_SELECTION" }));
}
