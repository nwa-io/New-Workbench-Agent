import type { AssetRef } from "../../shared/types";
import { uint8ToBase64 } from "../../shared/util/base64";
import { slugify } from "../../shared/util/slugify";
import { readExportPath, readIconName } from "../storage/nodeData";

export async function exportAssetForNode(
  n: SceneNode,
  kind: "icon" | "image" | "vector"
): Promise<AssetRef | null> {
  try {
    if (!("exportAsync" in n)) return null;
    const format: "svg" | "png" = kind === "image" ? "png" : "svg";
    const data =
      format === "svg"
        ? await (n as ExportMixin).exportAsync({ format: "SVG" })
        : await (n as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 2 },
          });
    const customName = readIconName(n);
    const name = customName || slugify(n.name) || "asset";
    const folder =
      kind === "icon" ? "icons" : kind === "vector" ? "vectors" : "images";
    const customPath = readExportPath(n);
    const filePath = customPath || `${folder}/${name}.${format}`;
    const path = `@${folder}/${name}.${format}`;
    return {
      type: kind,
      name,
      path,
      filePath,
      figmaNodeId: n.id,
      base64: uint8ToBase64(data),
      format,
    };
  } catch {
    return null;
  }
}
