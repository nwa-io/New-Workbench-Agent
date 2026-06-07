// Walks a node and pushes the node itself plus every visible descendant.
// Hidden subtrees are skipped because selecting them confuses the user (they
// can't see what's highlighted in the viewport).
export function collectVisibleDescendants(
  n: SceneNode,
  out: SceneNode[],
  seen: Set<string>
): void {
  if (seen.has(n.id)) return;
  if (n.visible === false) return;
  seen.add(n.id);
  out.push(n);
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      collectVisibleDescendants(c, out, seen);
    }
  }
}

export function expandCurrentSelection(): SceneNode[] {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) return [];
  const all: SceneNode[] = [];
  const seen = new Set<string>();
  for (const r of sel) collectVisibleDescendants(r, all, seen);
  return all;
}
