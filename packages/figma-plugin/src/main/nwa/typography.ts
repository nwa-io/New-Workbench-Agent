import { stableJson } from "../../shared/util/stableJson";
import type { NwaCtx } from "./ctx";
import { nodeIdFromFigma } from "./ids";
import { ensureStyle } from "./styles";

export function registerTypography(
  t: TextNode,
  name: string,
  ctx: NwaCtx
): string | undefined {
  const family = typeof t.fontName === "object" ? t.fontName.family : undefined;
  const style = typeof t.fontName === "object" ? t.fontName.style : undefined;
  const size = typeof t.fontSize === "number" ? t.fontSize : undefined;
  const fontWeight = inferFontWeight(style);
  const props: Record<string, unknown> = {
    text: typeof t.characters === "string" ? t.characters : undefined,
    fontFamily: family,
    fontSize: size,
    fontWeight,
    lineHeight: typeof t.lineHeight === "object" ? t.lineHeight : undefined,
    letterSpacing:
      typeof t.letterSpacing === "object" ? t.letterSpacing : undefined,
  };
  const sig = stableJson(props);
  const idBase = `typograph-text-${nodeIdFromFigma(name, t.id)}`;
  const entry = ensureStyle(ctx.typography, sig, idBase, name, "text", props);
  return `@styles/typography#${entry.id}`;
}

function inferFontWeight(style: string | undefined): number | undefined {
  if (!style) return undefined;
  const s = style.toLowerCase();
  if (s.includes("thin")) return 100;
  if (s.includes("extralight") || s.includes("ultra light")) return 200;
  if (s.includes("light")) return 300;
  if (s.includes("regular") || s.includes("normal") || s.includes("book"))
    return 400;
  if (s.includes("medium")) return 500;
  if (
    s.includes("semibold") ||
    s.includes("semi bold") ||
    s.includes("demi")
  )
    return 600;
  if (s.includes("extrabold") || s.includes("ultra bold")) return 800;
  if (s.includes("bold")) return 700;
  if (s.includes("black") || s.includes("heavy")) return 900;
  return 400;
}
