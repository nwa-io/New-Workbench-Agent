import {
  STORAGE_KEY_COMPONENT_CATALOG,
  STORAGE_KEY_TOKEN_CATALOG,
} from "../../shared/constants";
import type {
  FEComponentCatalogItem,
  FETokenCatalogItem,
} from "../../shared/types";
import { loadArray, saveValue } from "./clientStorage";

export function loadComponentCatalog(): Promise<FEComponentCatalogItem[]> {
  return loadArray<FEComponentCatalogItem>(STORAGE_KEY_COMPONENT_CATALOG);
}

export function loadTokenCatalog(): Promise<FETokenCatalogItem[]> {
  return loadArray<FETokenCatalogItem>(STORAGE_KEY_TOKEN_CATALOG);
}

export function saveComponentCatalog(
  items: FEComponentCatalogItem[]
): Promise<void> {
  return saveValue(STORAGE_KEY_COMPONENT_CATALOG, items);
}

export function saveTokenCatalog(items: FETokenCatalogItem[]): Promise<void> {
  return saveValue(STORAGE_KEY_TOKEN_CATALOG, items);
}
