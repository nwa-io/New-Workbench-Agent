import { applyStatus, StatusKind } from "../../helpers/status";
import { state } from "../../state";
import {
  catalogInfo,
  connLabel,
  connPill,
  connStatus,
  handshakeInfo,
} from "./elements";

export function setConnUi(): void {
  connPill.classList.remove("ok", "warn", "err");
  switch (state.ws.status) {
    case "open":
    case "handshaken":
      connPill.classList.add("ok");
      connLabel.textContent = state.ws.handshake?.projectName
        ? `Connected · ${state.ws.handshake.projectName}`
        : "Connected";
      break;
    case "connecting":
      connPill.classList.add("warn");
      connLabel.textContent = "Connecting…";
      break;
    default:
      connPill.classList.add("err");
      connLabel.textContent = "Offline";
  }
}

export function setConnStatus(text: string, kind: StatusKind = "info"): void {
  applyStatus(connStatus, text, kind);
}

export function renderHandshake(): void {
  if (!state.ws.handshake) {
    handshakeInfo.textContent = "No handshake yet.";
    return;
  }
  const h = state.ws.handshake;
  handshakeInfo.textContent =
    `project: ${h.projectName}` +
    (h.framework ? ` · framework: ${h.framework}` : "") +
    (state.ws.lastSyncAt ? ` · last sync: ${state.ws.lastSyncAt}` : "");
}

export function renderCatalogInfo(): void {
  const c = state.catalogs;
  if (!c.components.length && !c.tokens.length) {
    catalogInfo.textContent = "No catalog received from VS Code yet.";
  } else {
    catalogInfo.textContent = `${c.components.length} components · ${c.tokens.length} tokens cached.`;
  }
}
