import type {
  ComponentMapping,
  SelectionTreeNode,
} from "../../../shared/types";
import { send } from "../../postbox";
import { isSocketOpen, wsSend } from "../connection/socket";
import {
  findMappingForTreeNode,
  treeNodeMappingName,
} from "../mappings/active";
import type { CodeComponentOption } from "../mappings/options";
import { openRecordModal } from "../records-manager/modal";
import { setExportStatus } from "./status";

export function saveTreeNodeMapping(
  node: SelectionTreeNode,
  option: CodeComponentOption
): void {
  const existing = findMappingForTreeNode(node);
  const next: ComponentMapping = {
    ...(existing ?? {
      id: `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      source: "manual" as const,
      updatedAt: new Date().toISOString(),
    }),
    figmaName: treeNodeMappingName(node),
    figmaNodeId: node.id,
    figmaComponentKey: node.figmaComponentKey,
    codeComponent: option.componentName,
    codeFilePath: option.filePath,
    importType: option.importType,
    importName:
      option.importName ??
      (option.importType === "named" ? option.componentName : undefined),
    confidence: 1,
    source: "confirmed",
    updatedAt: new Date().toISOString(),
  };
  send({ type: "SAVE_MAPPING", mapping: next });
  if (isSocketOpen()) {
    wsSend({ type: "SAVE_MAPPING", mapping: next });
  }
  setExportStatus(`Saved mapping for ${node.name}.`, "ok");
}

export function openTreeNodeRecordModal(
  node: SelectionTreeNode,
  option?: CodeComponentOption
): void {
  const existing = findMappingForTreeNode(node);
  if (existing) {
    openRecordModal(existing);
    return;
  }
  openRecordModal(
    {
      figmaName: treeNodeMappingName(node),
      figmaNodeId: node.id,
      figmaComponentKey: node.figmaComponentKey,
      codeComponent: option?.componentName ?? "",
      codeFilePath: option?.filePath ?? "",
      importType: option?.importType ?? "named",
      importName: option?.importName ?? option?.componentName,
      confidence: 1,
      source: "manual",
      updatedAt: new Date().toISOString(),
    },
    { mode: "create" }
  );
}
