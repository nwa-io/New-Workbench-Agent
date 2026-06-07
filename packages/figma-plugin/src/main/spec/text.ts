import type { TextSpec } from "../../shared/types";
import { matchTokenName } from "../matcher/catalog";
import type { BuildCtx } from "./ctx";

export async function buildTextNode(n: TextNode, ctx: BuildCtx): Promise<TextSpec> {
  const family = typeof n.fontName === "object" ? n.fontName.family : undefined;
  const fontStyle = typeof n.fontName === "object" ? n.fontName.style : undefined;

  let tokenRef: string | undefined;
  try {
    const sid = (n as unknown as { textStyleId?: string | symbol }).textStyleId;
    if (typeof sid === "string" && sid) {
      const style = await figma.getStyleByIdAsync(sid);
      if (style) tokenRef = style.name;
    }
  } catch {
    /* ignore */
  }

  if (tokenRef) {
    const key = `typo:${tokenRef}`;
    if (!ctx.tokens.has(key)) {
      ctx.tokens.set(key, {
        figmaTokenName: tokenRef,
        type: "typography",
        value: { family, style: fontStyle, size: n.fontSize },
        usageCount: 1,
        ...(matchTokenName(tokenRef, ctx.tokenCatalog) ?? {}),
      });
    } else {
      ctx.tokens.get(key)!.usageCount++;
    }
  }

  return {
    type: "text_node",
    name: n.name,
    figmaNodeId: n.id,
    text: typeof n.characters === "string" ? n.characters : "",
    typography: {
      tokenRef,
      raw: {
        family,
        style: fontStyle,
        size: typeof n.fontSize === "number" ? n.fontSize : undefined,
        lineHeight: typeof n.lineHeight === "object" ? n.lineHeight : undefined,
        letterSpacing:
          typeof n.letterSpacing === "object" ? n.letterSpacing : undefined,
        align: n.textAlignHorizontal,
        valign: n.textAlignVertical,
        case: n.textCase,
        decoration: n.textDecoration,
      },
    },
  };
}
