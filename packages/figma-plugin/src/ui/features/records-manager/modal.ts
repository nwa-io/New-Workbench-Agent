import type { ComponentMapping } from "../../../shared/types";
import { iconSvg } from "../../dom/icons";
import { send } from "../../postbox";
import { state } from "../../state";
import { wsSend, isSocketOpen } from "../connection/socket";
import {
  ffCodeComponent,
  figmaNameDropdown,
  modalCreateLabel,
  modalHeaderIcon,
  modalSubEl,
  modalTitleEl,
  recCodeComponent,
  recConfidence,
  recDefaultProps,
  recFigmaKey,
  recFigmaName,
  recImportName,
  recImportType,
  recMergeChildren,
  recPreviewUrl,
  recPropMapping,
  recCodePath,
  recordModal,
} from "./elements";
import {
  renderFigmaNameOptions,
} from "./nameCombo";

let editingRecord: ComponentMapping | null = null;
let recordDraft: Partial<ComponentMapping> | null = null;

export function openRecordModal(
  m?: Partial<ComponentMapping>,
  options: { mode?: "create" | "edit" } = {}
): void {
  const isEdit = !!m && options.mode !== "create";
  editingRecord = isEdit ? (m as ComponentMapping) : null;
  recordDraft = isEdit ? null : (m ?? null);
  ffCodeComponent.classList.remove("error");

  // Refresh the Figma Name autocomplete list (file may have changed).
  renderFigmaNameOptions();
  send({ type: "GET_FIGMA_COMPONENTS" });

  if (isEdit && m) {
    modalTitleEl.textContent = `Edit · ${m.codeComponent || m.figmaName}`;
    modalSubEl.textContent = "Update this component mapping";
    modalHeaderIcon.textContent = "";
    modalHeaderIcon.appendChild(
      iconSvg("M2.5 13.5l3-.5L13.5 5l-2.5-2.5L3 10.5l-.5 3z", 18)
    );
    modalCreateLabel.textContent = "Save Changes";
  } else {
    modalTitleEl.textContent = "Add New Component Record";
    modalSubEl.textContent = "Create a new component mapping";
    modalHeaderIcon.textContent = "+";
    modalCreateLabel.textContent = "Create Record";
  }

  recCodeComponent.value = m?.codeComponent ?? "";
  recFigmaName.value = m?.figmaName ?? state.selection?.name ?? "";
  recCodePath.value = m?.codeFilePath ?? "";
  recPreviewUrl.value = m?.previewUiUrl ?? "";
  recFigmaKey.value = m?.figmaComponentKey ?? "";
  recImportType.value = m?.importType ?? "named";
  recImportName.value = m?.importName ?? "";
  recPropMapping.value = JSON.stringify(m?.propMapping ?? {}, null, 2);
  recDefaultProps.value = JSON.stringify(m?.defaultProps ?? {}, null, 2);
  recMergeChildren.checked = !!m?.mergeChildProps;
  recConfidence.value = String(m?.confidence ?? 1);

  recordModal.hidden = false;
  window.setTimeout(() => recCodeComponent.focus(), 0);

  // Ensure the autocomplete dropdown doesn't carry over from a prior open.
  figmaNameDropdown.hidden = true;
}

export function closeRecordModal(): void {
  recordModal.hidden = true;
  editingRecord = null;
  recordDraft = null;
}

export function saveRecordFromModal(): void {
  const codeComponent = recCodeComponent.value.trim();
  if (!codeComponent) {
    ffCodeComponent.classList.add("error");
    recCodeComponent.focus();
    return;
  }

  let propMapping: Record<string, string> | undefined;
  let defaultProps: Record<string, unknown> | undefined;
  try {
    propMapping = recPropMapping.value.trim()
      ? JSON.parse(recPropMapping.value)
      : undefined;
  } catch {
    // eslint-disable-next-line no-alert
    alert("Prop Mapping is not valid JSON.");
    return;
  }
  try {
    defaultProps = recDefaultProps.value.trim()
      ? JSON.parse(recDefaultProps.value)
      : undefined;
  } catch {
    // eslint-disable-next-line no-alert
    alert("Default Props is not valid JSON.");
    return;
  }

  const base: Partial<ComponentMapping> &
    Pick<ComponentMapping, "id" | "source" | "updatedAt"> =
    editingRecord ?? {
      ...(recordDraft ?? {}),
      id:
        recordDraft?.id ??
        `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      source: recordDraft?.source ?? "manual",
      updatedAt: recordDraft?.updatedAt ?? new Date().toISOString(),
    };

  const next: ComponentMapping = {
    ...base,
    codeComponent,
    figmaName: recFigmaName.value.trim(),
    figmaNodeId: base.figmaNodeId || undefined,
    codeFilePath: recCodePath.value.trim(),
    previewUiUrl: recPreviewUrl.value.trim() || undefined,
    figmaComponentKey:
      recFigmaKey.value.trim() || base.figmaComponentKey || undefined,
    importType: recImportType.value as "named" | "default",
    importName: recImportName.value.trim() || undefined,
    propMapping,
    defaultProps,
    mergeChildProps: recMergeChildren.checked,
    confidence: Math.max(0, Math.min(1, Number(recConfidence.value) || 1)),
    source: "confirmed",
    updatedAt: new Date().toISOString(),
  };

  send({ type: "SAVE_MAPPING", mapping: next });
  if (isSocketOpen()) {
    wsSend({ type: "SAVE_MAPPING", mapping: next });
  }
  closeRecordModal();
}
