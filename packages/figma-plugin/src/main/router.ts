import type { UiToMain } from "../shared/types";
import { handleBuildSpec } from "./handlers/buildSpec";
import { handleSetCatalogs } from "./handlers/catalogs";
import { handleInit } from "./handlers/init";
import {
  handleDeleteMapping,
  handleGetMappings,
  handleSaveMapping,
} from "./handlers/mappings";
import { handleSetNodeMark } from "./handlers/nodeMark";
import {
  handleAutofillMappings,
  handleGetFigmaComponents,
  handleScanSelection,
} from "./handlers/scan";
import {
  handleExpandSelection,
  handleZoomToNode,
  handleZoomToSelection,
} from "./handlers/viewport";
import { postToUi } from "./postbox";

export async function handleUiMessage(msg: UiToMain): Promise<void> {
  try {
    switch (msg.type) {
      case "INIT":
        return handleInit();
      case "GET_MAPPINGS":
        return handleGetMappings();
      case "SAVE_MAPPING":
        return handleSaveMapping(msg.mapping);
      case "DELETE_MAPPING":
        return handleDeleteMapping(msg.id);
      case "SET_CATALOGS":
        return handleSetCatalogs(msg.components, msg.tokens);
      case "SCAN_SELECTION":
        return handleScanSelection();
      case "AUTOFILL_MAPPINGS":
        return handleAutofillMappings();
      case "BUILD_SPEC":
        return handleBuildSpec();
      case "SET_NODE_MARK":
        return handleSetNodeMark(
          msg.nodeId,
          msg.mark,
          msg.iconName,
          msg.exportPath
        );
      case "ZOOM_TO_NODE":
        return handleZoomToNode(msg.nodeId, msg.highlight, msg.preserveSelection);
      case "ZOOM_TO_SELECTION":
        return handleZoomToSelection();
      case "EXPAND_SELECTION":
        return handleExpandSelection();
      case "GET_FIGMA_COMPONENTS":
        return handleGetFigmaComponents();
      case "CLOSE_PLUGIN":
        figma.closePlugin();
        return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postToUi({ type: "ERROR", error: message });
    figma.notify(message, { error: true });
  }
}
