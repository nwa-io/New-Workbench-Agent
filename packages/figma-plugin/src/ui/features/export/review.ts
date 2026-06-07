import { el } from "../../dom/el";
import { exportCountEl, exportMain, exportReview, reviewRowsEl } from "./elements";
import { reviewState } from "./reviewRows";

export function openReviewView(): void {
  exportMain.style.display = "none";
  exportReview.style.display = "";
  renderReviewTable();
}

export function closeReviewView(): void {
  exportReview.style.display = "none";
  exportMain.style.display = "";
}

export function renderReviewTable(): void {
  reviewRowsEl.innerHTML = "";
  exportCountEl.textContent = String(reviewState.lastReviewComponents.length);
  if (!reviewState.lastReviewComponents.length) {
    reviewRowsEl.append(el("div", { class: "empty" }, "Nothing to review."));
    return;
  }
  for (const c of reviewState.lastReviewComponents) {
    reviewRowsEl.append(
      el(
        "div",
        { class: "review-row" },
        el(
          "div",
          { class: "rc-component" },
          el("div", { class: "nm" }, c.name),
          el("div", { class: "ty" }, c.type)
        ),
        el(
          "div",
          {
            class: `rc-value${c.codeComponent ? "" : " missing"}`,
          },
          c.codeComponent ?? "Not specified"
        ),
        el(
          "div",
          {
            class: `rc-value${c.codeFilePath ? "" : " missing"}`,
          },
          c.codeFilePath ?? "Not specified"
        )
      )
    );
  }
}

export function isReviewOpen(): boolean {
  return exportReview.style.display !== "none";
}
