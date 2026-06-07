import { slugify } from "../../shared/util/slugify";
import {
  readExportPath,
  readIconName,
  getMark,
} from "../storage/nodeData";
import type { NwaCtx } from "./ctx";

const ICON_MAX = 80;
const ICON_NAME_RE =
  /(^|[\/_\-\s])(icon|close|check|checkmark|chevron|chevron-up|chevron-down|chevron-left|chevron-right|arrow|arrow-up|arrow-down|arrow-left|arrow-right|plus|minus|search|menu|dots|more|x|x-close|chevron-selector-vertical)([\/_\-\s]|$)/i;

export async function maybeExportIcon(
  n: SceneNode,
  ctx: NwaCtx
): Promise<string | null> {
  if (ctx.iconNodeIds.has(n.id)) return null;
  const isManuallyMarkedIcon = getMark(n) === "icon";
  const w = (n as unknown as { width?: number }).width ?? Infinity;
  const h = (n as unknown as { height?: number }).height ?? Infinity;
  const isSmall = w <= ICON_MAX && h <= ICON_MAX;
  const nameMatches = ICON_NAME_RE.test(n.name);

  const looksLikeIcon =
    (n.type === "VECTOR" && isSmall) ||
    (n.type === "BOOLEAN_OPERATION" && isSmall) ||
    (nameMatches &&
      (n.type === "INSTANCE" || n.type === "COMPONENT" || n.type === "FRAME"));

  if (!isManuallyMarkedIcon && !looksLikeIcon) return null;
  if (!("exportAsync" in n)) return null;

  try {
    const data = await (n as ExportMixin).exportAsync({ format: "SVG" });
    const filename = isManuallyMarkedIcon
      ? manualIconFilenameFor(n)
      : iconFilenameFor(n.name, n.id);
    ctx.icons.set(filename, data);
    ctx.iconNodeIds.add(n.id);
    return filename;
  } catch {
    return null;
  }
}

function iconFilenameFor(name: string, figmaId: string): string {
  const slug = slugify(name).replace(/-/g, "_") || "icon";
  const fid = figmaId.toLowerCase().replace(/[:;]/g, "_");
  return `ic_${slug}_${fid}.svg`;
}

function manualIconFilenameFor(n: SceneNode): string {
  const customPath = readExportPath(n);
  const pathFileName = customPath.split(/[\\/]/).filter(Boolean).pop();
  if (pathFileName && /\.svg$/i.test(pathFileName)) return pathFileName;
  const customName = readIconName(n);
  const slug = slugify(customName || n.name) || "icon";
  return `${slug}.svg`;
}
