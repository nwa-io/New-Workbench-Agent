import { PLUGIN_NAME, PLUGIN_VERSION } from "../../../shared/constants";
import type { WsIn } from "../../../shared/types";
import { state } from "../../state";
import { urlInput } from "./elements";
import { handleWsIn } from "./handler";
import { getSocket, setSocket, wsSend } from "./socket";
import { setConnStatus, setConnUi } from "./status";

let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let manuallyClosed = false;

export function resetReconnect(): void {
  manuallyClosed = false;
  reconnectAttempt = 0;
}

export function connect(): void {
  const url = urlInput.value.trim() || "ws://localhost:8080";
  if (!/^wss?:\/\//i.test(url)) {
    setConnStatus(`"${url}" is not a ws:// or wss:// URL.`, "err");
    return;
  }
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    getSocket()?.close();
  } catch {
    /* ignore */
  }

  state.ws.status = "connecting";
  setConnUi();
  setConnStatus(`Connecting to ${url}…`);

  let s: WebSocket;
  try {
    s = new WebSocket(url);
  } catch (err) {
    setConnStatus(
      `Failed to create socket: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
    scheduleReconnect();
    return;
  }
  setSocket(s);

  s.addEventListener("open", () => {
    state.ws.status = "open";
    reconnectAttempt = 0;
    setConnUi();
    setConnStatus(`Connected to ${url}. Sending handshake…`, "ok");
    wsSend({
      type: "HELLO_FROM_FIGMA",
      pluginName: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      figmaFileName: state.selection?.name ?? "",
      figmaPageName: "",
    });
  });

  s.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data) as WsIn;
      handleWsIn(msg);
    } catch (err) {
      setConnStatus(
        `Bad message from server: ${err instanceof Error ? err.message : String(err)}`,
        "warn"
      );
    }
  });

  s.addEventListener("close", () => {
    state.ws.status = "offline";
    setConnUi();
    if (!manuallyClosed) {
      setConnStatus("Disconnected. Will retry…", "warn");
      scheduleReconnect();
    } else {
      setConnStatus("Disconnected.", "warn");
    }
  });

  s.addEventListener("error", () => {
    setConnStatus(`Connection error to ${url}.`, "err");
  });
}

function scheduleReconnect(): void {
  reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
  const delay = Math.min(30_000, 500 * Math.pow(2, reconnectAttempt));
  reconnectTimer = window.setTimeout(connect, delay);
}
