export async function walkAsync(
  n: SceneNode,
  visit: (n: SceneNode) => Promise<void> | void
): Promise<void> {
  await visit(n);
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      await walkAsync(c, visit);
    }
  }
}

export async function tryGetMain(n: InstanceNode): Promise<ComponentNode | null> {
  try {
    return await n.getMainComponentAsync();
  } catch {
    return null;
  }
}
