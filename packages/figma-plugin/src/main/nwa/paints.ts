import { rgbaToHex, rgbToHex } from "../../shared/util/colors";
import { cleanFigmaValue } from "./yaml";

export function paintToProps(p: Paint): Record<string, unknown> {
  if (p.type === "SOLID") {
    return {
      type: "SOLID",
      color: rgbToHex(p.color, p.opacity ?? 1),
      opacity: p.opacity ?? 1,
      blendMode: p.blendMode ?? "NORMAL",
    };
  }
  return cleanFigmaValue(p) as Record<string, unknown>;
}

export function effectToProps(e: Effect): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: e.type,
    blendMode: (e as unknown as { blendMode?: string }).blendMode ?? "NORMAL",
  };
  if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
    const ds = e as DropShadowEffect | InnerShadowEffect;
    base.color = rgbaToHex(ds.color);
    base.offset = { x: ds.offset.x, y: ds.offset.y };
    base.radius = ds.radius;
    base.blur = null;
    base.spread = (ds as DropShadowEffect).spread ?? 0;
  } else {
    base.radius = (e as unknown as { radius?: number }).radius;
  }
  return base;
}
