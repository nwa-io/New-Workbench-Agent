// code.ts — Figma plugin main runtime entry.
//
// Thin orchestrator: boots the UI (or codegen launcher in Dev Mode), wires
// the selection-change listener, and routes UI messages to feature handlers.
// All real work lives under ./main/* — split per SOLID, feature-based layout.

import { bootstrap } from "./main/bootstrap";
import { handleUiMessage } from "./main/router";
import { wireSelectionChange } from "./main/selection/changes";

bootstrap();
wireSelectionChange();

figma.ui.onmessage = handleUiMessage;
