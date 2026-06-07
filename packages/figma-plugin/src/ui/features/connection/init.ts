import { reconnectBtn, requestCatalogBtn } from "./elements";
import { connect, resetReconnect } from "./reconnect";
import { isSocketOpen, wsSend } from "./socket";
import { setConnStatus } from "./status";

export function initConnection(): void {
  reconnectBtn.addEventListener("click", () => {
    resetReconnect();
    connect();
  });

  requestCatalogBtn.addEventListener("click", () => {
    if (isSocketOpen()) {
      const id = `cat_${Date.now()}`;
      wsSend({ type: "REQUEST_CATALOG", requestId: id });
      setConnStatus(`Requested catalog (id=${id})…`);
    } else {
      setConnStatus("Not connected.", "err");
    }
  });
}
