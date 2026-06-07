import type { AssetMark } from "../../shared/types";
import { writeMark } from "../storage/nodeData";

export async function handleSetNodeMark(
  nodeId: string,
  mark: AssetMark,
  iconName?: string,
  exportPath?: string
): Promise<void> {
  const n = await figma.getNodeByIdAsync(nodeId);
  if (!n || !("setPluginData" in n)) {
    figma.notify("Could not find that node to mark.", { error: true });
    return;
  }
  const node = n as BaseNode;

  if (mark) {
    writeMark(node, mark, iconName ?? "", exportPath ?? "");
    const label = iconName || (node as unknown as { name: string }).name;
    // Toast confirms the mark landed on the targeted node — the most common
    // cause of a missing icon in export is the modal closing on a stale id.
    figma.notify(
      `Marked "${label}" as ${mark} → ${exportPath ?? ""}`,
      { timeout: 2500 }
    );
  } else {
    writeMark(node, null, "", "");
    figma.notify(
      `Unmarked "${(node as unknown as { name: string }).name}".`,
      { timeout: 2000 }
    );
  }
}
