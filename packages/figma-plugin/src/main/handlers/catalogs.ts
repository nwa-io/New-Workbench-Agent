import type {
  FEComponentCatalogItem,
  FETokenCatalogItem,
} from "../../shared/types";
import {
  saveComponentCatalog,
  saveTokenCatalog,
} from "../storage/catalogs";

export async function handleSetCatalogs(
  components: FEComponentCatalogItem[] | undefined,
  tokens: FETokenCatalogItem[] | undefined
): Promise<void> {
  if (components) await saveComponentCatalog(components);
  if (tokens) await saveTokenCatalog(tokens);
}
