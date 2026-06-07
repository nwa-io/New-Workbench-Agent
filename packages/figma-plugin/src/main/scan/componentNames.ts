// Collects component names that exist in the Figma file, used to power the
// "Figma Name" autocomplete in the Component Records Manager.
//
// Sources, in priority order:
//   1. The current selection subtree — every INSTANCE node's own name, every
//      INSTANCE's resolved main component, and any COMPONENT / COMPONENT_SET
//      directly in the tree.
//   2. Every COMPONENT_SET / standalone COMPONENT in the whole document.
export async function collectFigmaComponentNames(): Promise<string[]> {
  const names = new Set<string>();

  const visit = async (n: SceneNode): Promise<void> => {
    if (n.type === "INSTANCE") {
      if (n.name) names.add(n.name);
      try {
        const mc = await (n as InstanceNode).getMainComponentAsync();
        if (mc) {
          if (mc.parent && mc.parent.type === "COMPONENT_SET") {
            names.add(mc.parent.name);
          } else if (mc.name) {
            names.add(mc.name);
          }
        }
      } catch {
        /* ignore unresolvable instance */
      }
    } else if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") {
      if (n.name) names.add(n.name);
    }
    if ("children" in n) {
      for (const c of (n as ChildrenMixin).children as SceneNode[]) {
        await visit(c);
      }
    }
  };

  try {
    for (const sel of figma.currentPage.selection) {
      await visit(sel);
    }
  } catch {
    /* ignore */
  }

  try {
    const found = figma.root.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    });
    for (const c of found) {
      if (
        c.type === "COMPONENT" &&
        c.parent &&
        c.parent.type === "COMPONENT_SET"
      ) {
        continue;
      }
      if (c.name) names.add(c.name);
    }
  } catch {
    /* findAllWithCriteria unavailable */
  }

  return Array.from(names)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
