import { $ } from "../../dom/$";
import { renderRecords } from "../records-manager/list";

export type ViewId = "main" | "settings" | "records";

export function navigateTo(view: ViewId): void {
  document.querySelectorAll<HTMLElement>(".view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${view}`);
  });
  const cardWrap = document.getElementById("selection-card-wrap");
  if (cardWrap) cardWrap.classList.toggle("hide", view !== "main");
  if (view === "records") renderRecords();
}

export function initNav(): void {
  $<HTMLButtonElement>("open-settings-btn").addEventListener("click", () =>
    navigateTo("settings")
  );
  $<HTMLButtonElement>("settings-back").addEventListener("click", () =>
    navigateTo("main")
  );
  $<HTMLButtonElement>("open-records-manager").addEventListener("click", () =>
    navigateTo("records")
  );
  $<HTMLButtonElement>("records-close").addEventListener("click", () =>
    navigateTo("settings")
  );
}
