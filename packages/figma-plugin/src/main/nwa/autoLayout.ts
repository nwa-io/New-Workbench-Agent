export function extractAutoLayout(n: SceneNode): Record<string, unknown> | undefined {
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
    layoutSizingHorizontal?: string;
    layoutSizingVertical?: string;
    layoutWrap?: string;
    itemReverseZIndex?: boolean;
  };
  if (!m.layoutMode || m.layoutMode === "NONE") return undefined;

  const out: Record<string, unknown> = {
    direction: m.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
  };
  if (typeof m.itemSpacing === "number" && m.itemSpacing !== 0)
    out.spacing = m.itemSpacing;
  const padding: Record<string, number> = {};
  if (m.paddingTop) padding.top = m.paddingTop;
  if (m.paddingRight) padding.right = m.paddingRight;
  if (m.paddingBottom) padding.bottom = m.paddingBottom;
  if (m.paddingLeft) padding.left = m.paddingLeft;
  if (Object.keys(padding).length) out.padding = padding;
  if (m.primaryAxisAlignItems && m.primaryAxisAlignItems !== "MIN")
    out.primaryAxisAlignItems = m.primaryAxisAlignItems;
  if (m.counterAxisAlignItems && m.counterAxisAlignItems !== "MIN")
    out.counterAxisAlignItems = m.counterAxisAlignItems;
  if (m.primaryAxisSizingMode) out.primaryAxisSizingMode = m.primaryAxisSizingMode;
  if (m.counterAxisSizingMode) out.counterAxisSizingMode = m.counterAxisSizingMode;
  if (m.layoutSizingHorizontal)
    out.layoutSizingHorizontal = m.layoutSizingHorizontal;
  if (m.layoutSizingVertical)
    out.layoutSizingVertical = m.layoutSizingVertical;
  if (m.layoutWrap && m.layoutWrap !== "NO_WRAP") out.layoutWrap = m.layoutWrap;
  if (m.itemReverseZIndex) out.itemReverseZIndex = true;
  return out;
}
