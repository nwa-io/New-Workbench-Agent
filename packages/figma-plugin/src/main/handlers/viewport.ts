import { expandCurrentSelection } from "../selection/expand";
import { flashHighlight } from "../selection/highlight";

export async function handleZoomToNode(
  nodeId: string,
  highlight?: boolean,
  preserveSelection?: boolean
): Promise<void> {
  const n = await figma.getNodeByIdAsync(nodeId);
  if (!n || n.type === "DOCUMENT" || n.type === "PAGE") return;
  const sceneNode = n as SceneNode;
  figma.viewport.scrollAndZoomIntoView([sceneNode]);

  if (highlight) {
    flashHighlight(sceneNode);
  } else if (!preserveSelection) {
    figma.currentPage.selection = [sceneNode];
  }
}

export function handleZoomToSelection(): void {
  const sel = figma.currentPage.selection;
  if (sel.length > 0) figma.viewport.scrollAndZoomIntoView(sel);
}

export function handleExpandSelection(): void {
  const all = expandCurrentSelection();
  if (all.length === 0) return;
  figma.currentPage.selection = all;
  figma.notify(
    `Expanded selection to ${all.length} node${all.length === 1 ? "" : "s"}.`
  );
}
