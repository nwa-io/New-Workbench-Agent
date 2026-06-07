import type { ReviewComponent } from "../../../shared/types";

// Latest scan result, kept so Review & Export can use it without re-scanning.
export const reviewState = {
  lastReviewComponents: [] as ReviewComponent[],
};

export function setLastReviewComponents(list: ReviewComponent[]): void {
  reviewState.lastReviewComponents = list;
}
