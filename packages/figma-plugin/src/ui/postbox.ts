import type { UiToMain } from "../shared/types";

export function send(msg: UiToMain): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}
