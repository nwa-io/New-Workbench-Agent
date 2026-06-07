// Shared "set status text + apply kind class" helper for the various status
// boxes in the UI (connection status, export status, review status, etc.).
export type StatusKind = "info" | "ok" | "warn" | "err";

export function applyStatus(
  el: HTMLElement,
  text: string,
  kind: StatusKind = "info"
): void {
  el.textContent = text;
  el.classList.remove("success", "warn", "error");
  if (kind === "ok") el.classList.add("success");
  else if (kind === "warn") el.classList.add("warn");
  else if (kind === "err") el.classList.add("error");
}

export type StatusSetter = (text: string, kind?: StatusKind) => void;
