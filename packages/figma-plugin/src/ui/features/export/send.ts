import { StatusSetter } from "../../helpers/status";
import { isSocketOpen, wsSend } from "../connection/socket";
import { getLastVsCodePayload } from "./payload";

export function sendNwaToVsCode(setStatus: StatusSetter): void {
  const payload = getLastVsCodePayload();
  if (!payload) {
    setStatus("Build the spec first.", "warn");
    return;
  }
  if (!isSocketOpen()) {
    setStatus(
      "Not connected to VS Code. Use Download ZIP or Download JSON instead.",
      "err"
    );
    return;
  }
  const requestId = `spec_${Date.now()}`;
  wsSend({
    type: "SEND_DESIGN_SPEC",
    requestId,
    payload,
  });
  setStatus(
    `Sent nwa bundle to VS Code (id=${requestId}, ` +
      `${Object.keys(payload.nwa.files).length} files, ` +
      `${payload.nwa.stats.uniqueComponents} components).`,
    "ok"
  );
}
