import { STORAGE_KEY_MAPPINGS } from "../../shared/constants";
import type { ComponentMapping } from "../../shared/types";
import { normaliseName } from "../../shared/util/normaliseName";
import { loadArray, saveValue } from "./clientStorage";
import { clearStickyMapping, writeStickyMapping } from "./nodeData";

export function loadMappings(): Promise<ComponentMapping[]> {
  return loadArray<ComponentMapping>(STORAGE_KEY_MAPPINGS);
}

export function saveMappings(list: ComponentMapping[]): Promise<void> {
  return saveValue(STORAGE_KEY_MAPPINGS, list);
}

export function mappingIdentityMatches(
  a: ComponentMapping,
  b: ComponentMapping
): boolean {
  return (
    a.id === b.id ||
    (!!a.figmaComponentKey && a.figmaComponentKey === b.figmaComponentKey) ||
    (!!a.figmaNodeId && a.figmaNodeId === b.figmaNodeId) ||
    normaliseName(a.figmaName) === normaliseName(b.figmaName)
  );
}

export async function upsertMapping(
  mapping: ComponentMapping
): Promise<ComponentMapping[]> {
  const list = await loadMappings();
  const idx = list.findIndex((m) => mappingIdentityMatches(m, mapping));
  const stamped: ComponentMapping = {
    ...mapping,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await saveMappings(list);

  // Sticky tag on the node so the mapping survives file copies / re-renders.
  if (stamped.figmaNodeId) {
    try {
      const node = await figma.getNodeByIdAsync(stamped.figmaNodeId);
      if (node) writeStickyMapping(node, stamped.id, stamped.codeComponent);
    } catch {
      /* node may have been removed; tag was best-effort */
    }
  }
  return list;
}

export async function deleteMapping(id: string): Promise<ComponentMapping[]> {
  const list = await loadMappings();
  const removed = list.find((m) => m.id === id);
  const next = list.filter((m) => m.id !== id);
  await saveMappings(next);

  if (removed?.figmaNodeId) {
    try {
      const node = await figma.getNodeByIdAsync(removed.figmaNodeId);
      if (node) clearStickyMapping(node);
    } catch {
      /* node already gone */
    }
  }
  return next;
}
