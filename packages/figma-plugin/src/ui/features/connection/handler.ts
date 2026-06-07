import type { WsIn } from "../../../shared/types";
import { send } from "../../postbox";
import { state } from "../../state";
import { setReviewStatus } from "../export/status";
import { renderSelectionTree } from "../export/tree";
import { treeState } from "../export/treeState";
import { renderTreeNodePanel } from "../export/nodePanel";
import { mergeProjectMappingsIntoLocal } from "../mappings/projectMappings";
import { renderRecords } from "../records-manager/list";
import { setConnStatus, setConnUi, renderCatalogInfo, renderHandshake } from "./status";
import { wsSend } from "./socket";

export function handleWsIn(msg: WsIn): void {
  switch (msg.type) {
    case "HELLO_FROM_VSCODE": {
      state.ws.status = "handshaken";
      state.ws.handshake = {
        projectName: msg.projectName,
        framework: msg.framework,
      };
      state.ws.lastSyncAt = new Date().toISOString();
      setConnUi();
      renderHandshake();
      // Adopt any project-level mappings the bridge attached to the handshake.
      // These survive across files / users; local clientStorage stays as a
      // warm cache so the plugin still works while offline.
      if (
        Array.isArray(msg.projectMappings) &&
        msg.projectMappings.length > 0
      ) {
        state.projectMappings = msg.projectMappings;
        mergeProjectMappingsIntoLocal(msg.projectMappings);
        renderRecords();
        renderSelectionTree(treeState.lastSelectionTree);
      }
      const projectMappingsNote = msg.projectMappingsCount
        ? ` · ${msg.projectMappingsCount} project mapping${msg.projectMappingsCount === 1 ? "" : "s"} restored`
        : "";
      setConnStatus(
        `Handshake OK · project: ${msg.projectName}` +
          (msg.framework ? ` · framework: ${msg.framework}` : "") +
          projectMappingsNote,
        "ok"
      );
      // Auto-pull catalogs if VS Code advertises them.
      if (msg.componentCatalogAvailable || msg.tokenCatalogAvailable) {
        wsSend({
          type: "REQUEST_CATALOG",
          requestId: `auto_${Date.now()}`,
        });
      }
      // Always request the freshest project mappings as well, in case the
      // hello did not embed them (e.g. older VS Code extension).
      if (!msg.projectMappings) {
        wsSend({
          type: "REQUEST_PROJECT_MAPPINGS",
          requestId: `pm_${Date.now()}`,
        });
      }
      return;
    }

    case "PROJECT_MAPPINGS":
      state.projectMappings = msg.mappings ?? [];
      mergeProjectMappingsIntoLocal(state.projectMappings);
      renderRecords();
      renderSelectionTree(treeState.lastSelectionTree);
      setConnStatus(
        `Project mappings synced (${state.projectMappings.length}).`,
        "ok"
      );
      return;

    case "COMPONENT_CATALOG":
      state.catalogs.components = msg.items ?? [];
      send({ type: "SET_CATALOGS", components: state.catalogs.components });
      renderCatalogInfo();
      renderTreeNodePanel(treeState.activeTreeNode);
      setConnStatus(
        `Received ${msg.items.length} components from VS Code.`,
        "ok"
      );
      return;

    case "TOKEN_CATALOG":
      state.catalogs.tokens = msg.tokens ?? [];
      send({ type: "SET_CATALOGS", tokens: state.catalogs.tokens });
      renderCatalogInfo();
      setConnStatus(
        `Received ${msg.tokens.length} tokens from VS Code.`,
        "ok"
      );
      return;

    case "MAPPING_SUGGESTIONS":
      // Future: integrate into autofill list.
      return;

    case "SPEC_RECEIVED":
      setReviewStatus(
        msg.ok
          ? `VS Code acknowledged spec (id=${msg.requestId}).`
          : `VS Code rejected spec (id=${msg.requestId}): ${msg.message ?? "unknown"}`,
        msg.ok ? "ok" : "err"
      );
      return;
  }
}
