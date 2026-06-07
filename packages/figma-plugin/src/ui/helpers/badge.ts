import { el } from "../dom/el";

export function badge(
  text: string,
  kind: "ok" | "warn" | "err" | "muted" = "muted"
): HTMLSpanElement {
  return el("span", { class: `badge ${kind}` }, text);
}
