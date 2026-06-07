// ui.ts — Figma plugin iframe UI entry.
//
// Thin orchestrator. All features live under ./ui/* and are wired by
// bootstrapUi() — SOLID, feature-based layout.

import { bootstrapUi } from "./ui/bootstrap";

bootstrapUi();
