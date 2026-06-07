import { $ } from "../../dom/$";
import {
  recCodeComponent,
  recFigmaName,
  recordModal,
  recordsAddBtn,
  recordsAddFirstBtn,
  recordsExportBtn,
  recordsSearchInput,
  ffCodeComponent,
  figmaNameDropdown,
} from "./elements";
import { exportRecordsAsJson } from "./exportJson";
import { setRecordsSearch } from "./list";
import {
  closeRecordModal,
  openRecordModal,
  saveRecordFromModal,
} from "./modal";
import {
  getComboActiveIndex,
  hideFigmaNameDropdown,
  moveComboActive,
  showFigmaNameDropdown,
} from "./nameCombo";

export function initRecordsManager(): void {
  recordsSearchInput.addEventListener("input", () => {
    setRecordsSearch(recordsSearchInput.value.trim().toLowerCase());
  });

  recordsAddBtn.addEventListener("click", () => openRecordModal());
  recordsAddFirstBtn.addEventListener("click", () => openRecordModal());
  recordsExportBtn.addEventListener("click", () => exportRecordsAsJson());

  $<HTMLButtonElement>("modal-close").addEventListener("click", closeRecordModal);
  $<HTMLButtonElement>("modal-cancel").addEventListener(
    "click",
    closeRecordModal
  );
  $<HTMLButtonElement>("modal-create").addEventListener(
    "click",
    saveRecordFromModal
  );
  recordModal.addEventListener("click", (e) => {
    if (e.target === recordModal) closeRecordModal();
  });
  recCodeComponent.addEventListener("input", () => {
    if (recCodeComponent.value.trim()) ffCodeComponent.classList.remove("error");
  });

  recFigmaName.addEventListener("focus", showFigmaNameDropdown);
  recFigmaName.addEventListener("input", showFigmaNameDropdown);
  recFigmaName.addEventListener("blur", () => {
    // Delay so a mousedown on an option still registers.
    window.setTimeout(hideFigmaNameDropdown, 120);
  });
  recFigmaName.addEventListener("keydown", (e) => {
    if (figmaNameDropdown.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveComboActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveComboActive(-1);
    } else if (e.key === "Enter") {
      const opts =
        figmaNameDropdown.querySelectorAll<HTMLDivElement>(".combo-option");
      const activeIdx = getComboActiveIndex();
      if (activeIdx >= 0 && opts[activeIdx]) {
        e.preventDefault();
        recFigmaName.value = opts[activeIdx].textContent ?? "";
        hideFigmaNameDropdown();
      }
    } else if (e.key === "Escape") {
      hideFigmaNameDropdown();
    }
  });
}
