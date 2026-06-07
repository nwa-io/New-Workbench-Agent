type ElProps = Record<string, unknown> & {
  class?: string;
  style?: string;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === "class" && typeof v === "string") node.className = v;
    else if (k === "style" && typeof v === "string")
      node.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function")
      (node as unknown as Record<string, unknown>)[k] = v;
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children)
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}
