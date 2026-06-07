import {
  PLUGIN_DATA_CODE_COMPONENT,
  PLUGIN_DATA_EXPORT_PATH,
  PLUGIN_DATA_ICON_NAME,
  PLUGIN_DATA_MAPPING_ID,
  PLUGIN_DATA_MARK,
} from "../../shared/constants";
import type { AssetMark } from "../../shared/types";

export function readNodePluginData(n: SceneNode | BaseNode, key: string): string {
  try {
    if (!("getPluginData" in n)) return "";
    return (n as BaseNode).getPluginData(key) || "";
  } catch {
    return "";
  }
}

export function writeNodePluginData(n: BaseNode, key: string, value: string): void {
  try {
    if (!("setPluginData" in n)) return;
    n.setPluginData(key, value);
  } catch {
    /* node already gone */
  }
}

export function readStickyMappingId(n: SceneNode): string | undefined {
  const id = readNodePluginData(n, PLUGIN_DATA_MAPPING_ID);
  return id.length > 0 ? id : undefined;
}

export function writeStickyMapping(
  n: BaseNode,
  mappingId: string,
  codeComponent: string
): void {
  writeNodePluginData(n, PLUGIN_DATA_MAPPING_ID, mappingId);
  writeNodePluginData(n, PLUGIN_DATA_CODE_COMPONENT, codeComponent);
}

export function clearStickyMapping(n: BaseNode): void {
  writeNodePluginData(n, PLUGIN_DATA_MAPPING_ID, "");
  writeNodePluginData(n, PLUGIN_DATA_CODE_COMPONENT, "");
}

export function getMark(n: SceneNode): AssetMark {
  const v = readNodePluginData(n, PLUGIN_DATA_MARK);
  if (!v) return null;
  if (
    v === "icon" || v === "image" || v === "vector" ||
    v === "illustration" || v === "decorative" || v === "ignored"
  ) return v;
  return null;
}

export function writeMark(
  n: BaseNode,
  mark: AssetMark,
  iconName: string,
  exportPath: string
): void {
  writeNodePluginData(n, PLUGIN_DATA_MARK, mark ?? "");
  writeNodePluginData(n, PLUGIN_DATA_ICON_NAME, iconName);
  writeNodePluginData(n, PLUGIN_DATA_EXPORT_PATH, exportPath);
}

export function readIconName(n: SceneNode): string {
  return readNodePluginData(n, PLUGIN_DATA_ICON_NAME);
}

export function readExportPath(n: SceneNode): string {
  return readNodePluginData(n, PLUGIN_DATA_EXPORT_PATH);
}
