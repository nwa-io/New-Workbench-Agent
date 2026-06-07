export function extractLayout(n: SceneNode): Record<string, unknown> | undefined {
  if (!("layoutMode" in n)) return undefined;
  const m = n as unknown as {
    layoutMode?: string;
    itemSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    primaryAxisSizingMode?: string;
    counterAxisSizingMode?: string;
    layoutWrap?: string;
  };
  if (!m.layoutMode || m.layoutMode === "NONE") return undefined;
  return {
    display: "flex",
    direction: m.layoutMode === "HORIZONTAL" ? "row" : "column",
    gap: m.itemSpacing,
    padding: {
      left: m.paddingLeft,
      right: m.paddingRight,
      top: m.paddingTop,
      bottom: m.paddingBottom,
    },
    justify: m.primaryAxisAlignItems,
    align: m.counterAxisAlignItems,
    wrap: m.layoutWrap,
    sizing: {
      primary: m.primaryAxisSizingMode,
      counter: m.counterAxisSizingMode,
    },
  };
}
