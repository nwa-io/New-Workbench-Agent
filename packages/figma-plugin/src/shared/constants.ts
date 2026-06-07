export const PLUGIN_NAME = "Figma Clarity";
export const PLUGIN_VERSION = "0.3.0";

export const STORAGE_KEY_MAPPINGS = "vscode-bridge:mappings";
export const STORAGE_KEY_COMPONENT_CATALOG = "vscode-bridge:catalog:components";
export const STORAGE_KEY_TOKEN_CATALOG = "vscode-bridge:catalog:tokens";

export const PLUGIN_DATA_MARK = "vscode-mark";
export const PLUGIN_DATA_MAPPING_ID = "vscode-mapping-id";
export const PLUGIN_DATA_CODE_COMPONENT = "vscode-code-component";
export const PLUGIN_DATA_ICON_NAME = "vscode-icon-name";
export const PLUGIN_DATA_EXPORT_PATH = "vscode-export-path";

export const ALLOWED_SELECTION_TYPES = [
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
  "GROUP",
] as const;

export const UI_SIZE = { width: 700, height: 720 } as const;
