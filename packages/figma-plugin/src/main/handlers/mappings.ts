import type { ComponentMapping } from "../../shared/types";
import { postToUi } from "../postbox";
import {
  deleteMapping,
  loadMappings,
  upsertMapping,
} from "../storage/mappings";

export async function handleGetMappings(): Promise<void> {
  const mappings = await loadMappings();
  postToUi({ type: "MAPPINGS_UPDATED", mappings });
}

export async function handleSaveMapping(
  mapping: ComponentMapping
): Promise<void> {
  const mappings = await upsertMapping(mapping);
  postToUi({ type: "MAPPINGS_UPDATED", mappings });
}

export async function handleDeleteMapping(id: string): Promise<void> {
  const mappings = await deleteMapping(id);
  postToUi({ type: "MAPPINGS_UPDATED", mappings });
}
