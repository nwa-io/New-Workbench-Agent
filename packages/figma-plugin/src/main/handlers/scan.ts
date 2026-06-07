import { postToUi } from "../postbox";
import { autofillSuggestions } from "../scan/autofill";
import { collectFigmaComponentNames } from "../scan/componentNames";
import { summariseSelection } from "../scan/summary";
import { requireSelectedNode } from "../selection/state";
import {
  loadComponentCatalog,
} from "../storage/catalogs";
import { loadMappings } from "../storage/mappings";

export async function handleScanSelection(): Promise<void> {
  const node = requireSelectedNode();
  postToUi({ type: "PROGRESS", stage: "Scanning node tree…" });
  const summary = await summariseSelection(node);
  postToUi({ type: "SCAN_RESULT", summary });
}

export async function handleAutofillMappings(): Promise<void> {
  const node = requireSelectedNode();
  const [mappings, components] = await Promise.all([
    loadMappings(),
    loadComponentCatalog(),
  ]);
  postToUi({ type: "PROGRESS", stage: "Resolving INSTANCE nodes…" });
  const suggestions = await autofillSuggestions(node, mappings, components);
  postToUi({ type: "AUTOFILL_RESULT", suggestions });
}

export async function handleGetFigmaComponents(): Promise<void> {
  const names = await collectFigmaComponentNames();
  postToUi({ type: "FIGMA_COMPONENTS", names });
}
