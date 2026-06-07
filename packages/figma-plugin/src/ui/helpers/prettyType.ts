export function prettyType(t: string): string {
  return (
    {
      COMPONENT: "Component",
      COMPONENT_SET: "Component set",
      INSTANCE: "Instance",
      FRAME: "Frame",
      GROUP: "Group",
      SECTION: "Section",
    } as Record<string, string>
  )[t] ?? t.toLowerCase();
}

// Picks the most readable label out of a Figma component name. Names like
// "Button/Primary/Large" use the last segment (the most specific variant) as
// the title and keep the full path as the subtitle.
export function humanizeComponentTitle(raw: string): string {
  const cleaned = (raw || "").trim();
  if (!cleaned) return "Component";
  if (!cleaned.includes("/")) return cleaned;
  const segments = cleaned.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return cleaned;
  // "Button/Primary/Large" -> "Button · Large" so the consumer sees both the
  // category and the specific variant without the noisy middle segments.
  if (segments.length === 1) return segments[0];
  if (segments.length === 2) return segments.join(" · ");
  return `${segments[0]} · ${segments[segments.length - 1]}`;
}

export function normaliseUiName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}
