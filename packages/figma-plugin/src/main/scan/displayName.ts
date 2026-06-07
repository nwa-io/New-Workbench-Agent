// Pick the most human-readable label for an INSTANCE node.
//
// Figma variants live inside a COMPONENT_SET. The main component's own .name
// is the variant key (e.g. "Type=Normal, Breakpoint=Desktop"); the parent
// COMPONENT_SET carries the friendly base name (e.g. "Card header"). The
// instance node's .name follows the same default, so we walk:
//   1. mc.parent.name when the main lives inside a COMPONENT_SET
//   2. else mc.name (non-variant main component)
//   3. else the layer's own name as a last resort
export function getDisplayName(
  mc: ComponentNode | null,
  n: SceneNode
): string {
  if (mc && mc.parent && mc.parent.type === "COMPONENT_SET" && mc.parent.name) {
    return mc.parent.name;
  }
  if (mc && mc.name && !/=/.test(mc.name)) {
    return mc.name;
  }
  if (n.name && !/=/.test(n.name)) {
    return n.name;
  }
  return mc?.name || n.name || "Component";
}
