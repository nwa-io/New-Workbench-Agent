// Plugin-driven selection state for the "highlight flash" (eye icon).
//
// Conceptually we want two independent things:
//   - User selection — what the designer has clicked on the Figma canvas.
//     This is the *only* signal that should rebuild the plugin's Selection
//     tree.
//   - Tree-row focus — clicking the eye icon in a tree row paints Figma's
//     purple selection border on the target node so the user can spot it,
//     but it must NOT propagate back into the tree or the selection card.
//
// Figma's plugin API exposes a single global selection (figma.currentPage.
// selection) and fires selectionchange on every write — including the
// programmatic writes we use to render the flash. So we suppress those
// programmatic events explicitly: a flag is raised before the flash, every
// selectionchange that fires while the flag is up is swallowed, and the
// flag drops one microtask after the restore.

let flashing = false;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let flashRealSelection: SceneNode[] = [];

export function isFlashing(): boolean {
  return flashing;
}

export function flashHighlight(target: SceneNode): void {
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
  if (!flashing) {
    flashRealSelection = figma.currentPage.selection.slice();
    flashing = true;
  }

  figma.currentPage.selection = [target];
  figma.notify(`Focused on “${target.name || "node"}”`, { timeout: 2000 });

  flashTimer = setTimeout(() => {
    try {
      const stillValid = flashRealSelection.filter((s) => s.parent !== null);
      figma.currentPage.selection = stillValid;
    } catch {
      /* page may have changed; ignore */
    }
    setTimeout(() => {
      flashing = false;
      flashRealSelection = [];
      flashTimer = null;
    }, 50);
  }, 2000);
}
