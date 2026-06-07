import type { MainToUi } from "../shared/types";

export function postToUi(msg: MainToUi): void {
  // In Dev Mode the UI iframe may not be open yet; guard so postMessage
  // doesn't throw before the user clicks "Open plugin window".
  try {
    figma.ui.postMessage(msg);
  } catch {
    /* iframe not open yet — ignore */
  }
}
