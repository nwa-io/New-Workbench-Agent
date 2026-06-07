import { initDispatcher } from "./dispatcher";
import { initAssets } from "./features/assets/init";
import { initConnection } from "./features/connection/init";
import {
  renderCatalogInfo,
  renderHandshake,
  setConnUi,
} from "./features/connection/status";
import { initExport } from "./features/export/init";
import { initIconModal } from "./features/icon-modal/init";
import { initNav } from "./features/nav/navigate";
import { initRecordsManager } from "./features/records-manager/init";
import { renderRecords } from "./features/records-manager/list";
import { initSelectionCard } from "./features/selection-card/init";
import { initTabs } from "./features/tabs/init";
import { send } from "./postbox";

export function bootstrapUi(): void {
  // Wire features.
  initTabs();
  initNav();
  initSelectionCard();
  initConnection();
  initExport();
  initRecordsManager();
  initAssets();
  initIconModal();
  initDispatcher();

  // Initial paint of static panels.
  setConnUi();
  renderHandshake();
  renderCatalogInfo();
  renderRecords();

  // Ask the main runtime for state, then prefill the Figma component cache
  // for the records manager autocomplete.
  send({ type: "INIT" });
  send({ type: "GET_FIGMA_COMPONENTS" });
}
