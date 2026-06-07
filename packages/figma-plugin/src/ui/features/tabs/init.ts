import { $ } from "../../dom/$";

export function initTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`panel-${btn.dataset.tab}`).classList.add("active");
    });
  });
}
