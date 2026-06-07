import { postToUi } from "../postbox";
import { getSelectionState } from "../selection/state";
import {
  loadComponentCatalog,
  loadTokenCatalog,
} from "../storage/catalogs";
import { loadMappings } from "../storage/mappings";

export async function handleInit(): Promise<void> {
  const [mappings, components, tokens] = await Promise.all([
    loadMappings(),
    loadComponentCatalog(),
    loadTokenCatalog(),
  ]);
  const s = getSelectionState();
  postToUi({
    type: "INITIAL_STATE",
    mappings,
    ...s,
    catalogs: { components, tokens },
  });
}
