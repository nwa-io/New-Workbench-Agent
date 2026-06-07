import { postToUi } from "../postbox";
import { isFlashing } from "./highlight";
import { getSelectionState } from "./state";

export function wireSelectionChange(): void {
  figma.on("selectionchange", () => {
    if (isFlashing()) {
      // The flash and its restore write both produce selectionchange events;
      // both belong to the plugin, not the user, so drop them. The Selection
      // tree stays anchored to the user's real selection from before flashing.
      return;
    }
    const s = getSelectionState();
    postToUi({ type: "SELECTION_STATE", ...s });
  });
}
