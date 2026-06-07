export async function loadLocalVariables(): Promise<Map<string, Variable>> {
  const map = new Map<string, Variable>();
  try {
    const fn = (figma.variables as unknown as {
      getLocalVariablesAsync?: () => Promise<Variable[]>;
    }).getLocalVariablesAsync;
    let list: Variable[] = [];
    if (typeof fn === "function") list = await fn.call(figma.variables);
    else if (typeof figma.variables.getLocalVariables === "function")
      list = figma.variables.getLocalVariables();
    for (const v of list) map.set(v.id, v);
  } catch {
    /* variables API unavailable */
  }
  return map;
}

export function bindingForField(node: SceneNode, field: string): string | null {
  try {
    const bv = (node as unknown as { boundVariables?: Record<string, unknown> })
      .boundVariables;
    if (!bv) return null;
    const path = field.split(".");
    let cur: unknown = bv;
    for (const seg of path) {
      if (cur && typeof cur === "object") {
        const idx = Number(seg);
        cur = !isNaN(idx)
          ? (cur as unknown[])[idx]
          : (cur as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    if (cur && typeof cur === "object" && (cur as { id?: string }).id) {
      return (cur as { id: string }).id;
    }
    return null;
  } catch {
    return null;
  }
}
