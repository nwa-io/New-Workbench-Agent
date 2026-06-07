import { applyStatus, StatusKind } from "../../helpers/status";
import { exportStatus, reviewStatus } from "./elements";

export function setExportStatus(text: string, kind: StatusKind = "info"): void {
  applyStatus(exportStatus, text, kind);
}

export function setReviewStatus(text: string, kind: StatusKind = "info"): void {
  applyStatus(reviewStatus, text, kind);
}
