import JSZip from "jszip";
import type { NwaBundleInfo } from "../../../shared/types";
import { formatBytes } from "../../helpers/format";
import { StatusSetter } from "../../helpers/status";
import { state } from "../../state";
import { calcShrink, getLastVsCodePayload } from "./payload";

export async function downloadNwaAsZip(
  nwa: NwaBundleInfo,
  setStatus: StatusSetter
): Promise<void> {
  try {
    setStatus("Packing nwa bundle into ZIP…", "info");
    const zip = new JSZip();
    const root = zip.folder(nwa.rootSlug);
    if (!root) throw new Error("Failed to create zip folder");

    for (const [path, file] of Object.entries(nwa.files)) {
      if (file.kind === "text") {
        root.file(path, file.content);
      } else {
        root.file(path, file.base64, { base64: true });
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nwa.rootSlug}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus(
      `Downloaded ${nwa.rootSlug}.zip (${formatBytes(blob.size)}).\n` +
        `  components: ${nwa.stats.uniqueComponents} · icons: ${nwa.stats.icons} · ` +
        `fills: ${nwa.stats.fills} · strokes: ${nwa.stats.strokes} · ` +
        `effects: ${nwa.stats.effects} · type: ${nwa.stats.typography}`,
      "ok"
    );
  } catch (err) {
    setStatus(
      `Failed to build ZIP: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
  }
}

// Produces the same envelope the VS Code extension writes to
// `.project/figma/context/latest-figma-context.json` — i.e. the
// `StoredFigmaContext` shape: { source, receivedAt, transport, server,
// payload }. The payload is the same VsCodeDesignSpecPayload that
// `sendNwaToVsCode` transmits, with base64 stripped from `assets[]` and the
// legacy "@" prefix normalised out of `filePath` so it matches what the
// extension persists to disk.
export function downloadVsCodePayloadAsJson(setStatus: StatusSetter): void {
  try {
    const payload = getLastVsCodePayload();
    if (!payload || !state.lastNwa) {
      setStatus("Build the spec first.", "warn");
      return;
    }
    const sanitisedPayload = stripAssetBase64(payload);
    const storedContext = {
      source: "figma-plugin-websocket",
      receivedAt: new Date().toISOString(),
      transport: "websocket",
      server: { host: "127.0.0.1", port: 8080 },
      payload: sanitisedPayload,
    };
    const json = `${JSON.stringify(storedContext, null, 2)}\n`;
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `${state.lastNwa.rootSlug}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    const sizeNote =
      state.lastSpec && state.lastLean
        ? ` (${formatBytes(blob.size)}, lean is ${calcShrink(
            state.lastSpec,
            state.lastLean
          )}% smaller than raw)`
        : ` (${formatBytes(blob.size)})`;
    setStatus(
      `Downloaded ${filename}${sizeNote}. Same envelope written by the VS Code extension (named after the selected root node).`,
      "ok"
    );
  } catch (err) {
    setStatus(
      `Failed to build JSON: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
  }
}

// Mirror of `writeAssetsAndStripBase64` in src/shared/figmaStore.ts: removes
// `base64` from each asset and drops the legacy "@" prefix from `filePath`,
// so the downloaded JSON matches what the extension persists on disk.
function stripAssetBase64<T>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  const assets = p.assets;
  if (!Array.isArray(assets) || assets.length === 0) return payload;

  const sanitisedAssets = assets.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const asset = raw as Record<string, unknown>;
    const filePathRaw =
      typeof asset.filePath === "string"
        ? asset.filePath
        : typeof asset.path === "string"
        ? (asset.path as string)
        : "";
    const filePath = filePathRaw.replace(/^@/, "");
    const { base64: _base64, ...rest } = asset;
    return filePath ? { ...rest, filePath } : { ...rest };
  });

  return { ...p, assets: sanitisedAssets } as T;
}
