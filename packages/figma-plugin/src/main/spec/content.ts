import type {
  ComponentContent,
  ComponentContentText,
  SpecNode,
} from "../../shared/types";
import { matchMapping } from "../matcher";
import { getMark, readStickyMappingId } from "../storage/nodeData";
import { tryGetMain } from "../scan/walk";
import type { BuildCtx } from "./ctx";
import { MAX_CONTENT_TEXTS } from "./ctx";
import { buildNode } from "./node";

// Walks a matched component's subtree and emits the design payload the AI
// consumer needs to bind to real props:
//   - texts: every visible TEXT node in document order, keeping the Figma
//     layer name (the strongest hint for prop mapping)
//   - components: nested matched components, recursively (so the
//     "Card has Action button" structure survives)
// Unmatched layout wrappers (frames, groups) are transparent — they don't
// generate their own entries, but their descendants bubble up into the
// matched parent's content.
export async function collectContent(
  n: SceneNode,
  ctx: BuildCtx
): Promise<ComponentContent | undefined> {
  const texts: ComponentContentText[] = [];
  const components: SpecNode[] = [];
  await walkContent(n, texts, components, ctx, 0);

  const truncated = texts.length > MAX_CONTENT_TEXTS;
  const finalTexts = truncated ? texts.slice(0, MAX_CONTENT_TEXTS) : texts;

  if (finalTexts.length === 0 && components.length === 0) {
    return undefined;
  }

  const content: ComponentContent = {};
  if (finalTexts.length) content.texts = finalTexts;
  if (components.length) content.components = components;
  if (truncated) content.truncated = true;
  return content;
}

async function walkContent(
  n: SceneNode,
  texts: ComponentContentText[],
  components: SpecNode[],
  ctx: BuildCtx,
  depth: number
): Promise<void> {
  if (depth > 8) return;
  if (!("children" in n)) return;

  for (const child of (n as ChildrenMixin).children as SceneNode[]) {
    if ("visible" in child && child.visible === false) continue;

    const childMark = getMark(child);
    if (childMark === "icon" || childMark === "image" || childMark === "vector") {
      components.push(await buildNode(child, ctx, false));
      continue;
    }

    if (child.type === "TEXT") {
      const value =
        typeof (child as TextNode).characters === "string"
          ? (child as TextNode).characters.trim()
          : "";
      if (value) {
        texts.push({ name: child.name, value });
      }
      continue;
    }

    let figmaName = child.name;
    let figmaComponentKey: string | undefined;
    if (child.type === "INSTANCE") {
      const mc = await tryGetMain(child as InstanceNode);
      figmaName = mc?.name ?? child.name;
      figmaComponentKey = mc?.key;
    }
    const childSticky = readStickyMappingId(child);
    const childMatch = matchMapping(
      {
        figmaName,
        figmaComponentKey,
        figmaNodeId: child.id,
        stickyMappingId: childSticky,
      },
      ctx.mappings,
      ctx.components
    );
    if (childMatch) {
      components.push(await buildNode(child, ctx, false));
      continue;
    }

    // Unmatched wrapper — walk through transparently so its useful
    // descendants surface on the parent matched component.
    if ("children" in child) {
      await walkContent(child, texts, components, ctx, depth + 1);
    }
  }
}
