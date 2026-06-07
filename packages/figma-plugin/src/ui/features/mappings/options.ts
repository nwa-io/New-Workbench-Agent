import type {
  ComponentMapping,
  SelectionTreeNode,
} from "../../../shared/types";
import { state } from "../../state";
import { getActiveMappings } from "./active";

export interface CodeComponentOption {
  key: string;
  componentName: string;
  filePath: string;
  importType: "default" | "named";
  importName?: string;
}

export function codeOptionKey(
  componentName: string,
  filePath: string,
  importType: "default" | "named"
): string {
  return `${importType}::${componentName}::${filePath}`;
}

export function addCodeOption(
  options: Map<string, CodeComponentOption>,
  option: Omit<CodeComponentOption, "key">
): void {
  if (!option.componentName.trim()) return;
  const key = codeOptionKey(
    option.componentName,
    option.filePath,
    option.importType
  );
  if (!options.has(key)) {
    options.set(key, { ...option, key });
  }
}

export function codeOptionsForNode(
  node: SelectionTreeNode
): CodeComponentOption[] {
  const options = new Map<string, CodeComponentOption>();
  for (const c of state.catalogs.components) {
    addCodeOption(options, {
      componentName: c.componentName,
      filePath: c.filePath,
      importType: c.exportType,
      importName: c.exportType === "named" ? c.componentName : undefined,
    });
  }
  for (const m of getActiveMappings()) {
    addCodeOption(options, {
      componentName: m.codeComponent,
      filePath: m.codeFilePath,
      importType: m.importType,
      importName: m.importName,
    });
  }
  if (node.codeComponent) {
    addCodeOption(options, {
      componentName: node.codeComponent,
      filePath: node.codeFilePath ?? "",
      importType: node.importType ?? "named",
      importName: node.importName ?? node.codeComponent,
    });
  }
  return Array.from(options.values()).sort((a, b) =>
    a.componentName.localeCompare(b.componentName)
  );
}

export function optionFromMapping(
  mapping: ComponentMapping
): CodeComponentOption {
  return {
    key: codeOptionKey(
      mapping.codeComponent,
      mapping.codeFilePath,
      mapping.importType
    ),
    componentName: mapping.codeComponent,
    filePath: mapping.codeFilePath,
    importType: mapping.importType,
    importName: mapping.importName,
  };
}

export function customPropertySummary(mapping: ComponentMapping | null): string {
  if (!mapping) return "No custom properties";
  const propCount = Object.keys(mapping.propMapping ?? {}).length;
  const defaultCount = Object.keys(mapping.defaultProps ?? {}).length;
  const total = propCount + defaultCount + (mapping.mergeChildProps ? 1 : 0);
  if (!total) return "No custom properties";
  return `${total} custom ${total === 1 ? "property" : "properties"}`;
}
