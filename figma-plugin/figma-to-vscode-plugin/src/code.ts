// code.ts
//
// Figma plugin main runtime — MVP 1–5.
//
// Responsibilities:
//   - Extract a raw node tree from the current selection.
//   - Resolve INSTANCE nodes against a persisted Component Mapping registry
//     and the FE component catalog received from VS Code.
//   - Prune matched component subtrees ("Match + Prune").
//   - Extract design tokens (local variables + bound variables on nodes +
//     local color/text/effect styles) and match against the FE token catalog
//     received from VS Code.
//   - Export marked icon/image/vector assets to bytes.
//   - Produce a CompressedSpec that the UI can ship to VS Code.
//
// Persistence:
//   - Component mappings + FE catalogs live in figma.clientStorage (per user).
//   - Per-node asset marks live in node.setPluginData("vscode-mark", ...).

import {
  AssetMark,
  AssetRef,
  AssetRefSpec,
  AutofillSuggestion,
  ComponentMapping,
  ComponentRefSpec,
  CompressedSpec,
  DesignTokenRef,
  FEComponentCatalogItem,
  FETokenCatalogItem,
  LayoutSpec,
  MainToUi,
  MappingReport,
  PLUGIN_VERSION,
  ReviewComponent,
  SelectionTreeNode,
  SpecNode,
  TextSpec,
  TokenKind,
  UiToMain,
} from "./types";
import { buildSpexBundle } from "./spex";

const ALLOWED_SELECTION_TYPES: ReadonlyArray<NodeType> = [
  "FRAME",
  "COMPONENT",
  "COMPONENT_SET",
  "INSTANCE",
  "SECTION",
  "GROUP",
];

const STORAGE_KEY_MAPPINGS = "vscode-bridge:mappings";
const STORAGE_KEY_COMPONENT_CATALOG = "vscode-bridge:catalog:components";
const STORAGE_KEY_TOKEN_CATALOG = "vscode-bridge:catalog:tokens";
const PLUGIN_DATA_MARK = "vscode-mark";
const UI_SIZE = { width: 700, height: 720 } as const;

// The plugin runs in two contexts:
//   - Figma Design (figma.mode === "default"): we show the full iframe UI
//     immediately so the user gets all five tabs + Component Records Manager.
//   - Dev Mode (figma.mode === "codegen"): Figma forbids calling
//     figma.showUI() on plugin load. We register a codegen handler that
//     puts a small "Open plugin window" hint + propertyMenu in the right
//     inspect panel. Clicking it fires "preferenceschanged" and THEN we can
//     legally call figma.showUI() to open the full iframe.
const IS_CODEGEN = figma.mode === "codegen";

if (!IS_CODEGEN) {
  figma.showUI(__html__, { ...UI_SIZE, themeColors: true });
} else {
  registerCodegenLauncher();
}

function post(msg: MainToUi): void {
  // In Dev Mode the UI iframe may not be open yet; guard so postMessage
  // doesn't throw before the user clicks "Open plugin window".
  try {
    figma.ui.postMessage(msg);
  } catch {
    /* iframe not open yet — ignore */
  }
}

function registerCodegenLauncher(): void {
  const codegen = (figma as unknown as {
    codegen?: {
      on: (
        event: "generate" | "preferenceschange",
        cb: (e: never) => unknown
      ) => void;
    };
  }).codegen;
  if (!codegen) return;

  // Render a hint snippet in the inspect panel. The "Open plugin window"
  // action is declared in manifest.codegenPreferences and surfaces as the
  // panel's settings (gear/···) menu.
  codegen.on(
    "generate",
    (() => {
      return [
        {
          title: "Figma to VS Code Sender",
          code:
            "// Open the inspect panel's settings menu and pick\n" +
            "// 'Open plugin window' to launch the full UI:\n" +
            "//   - Connection / handshake with VS Code\n" +
            "//   - Export / Build SpeX bundle / Send / Download\n" +
            "//   - Tokens, Assets, Report\n" +
            "//   - Settings -> Component Records Manager",
          language: "PLAINTEXT",
        },
      ];
    }) as never
  );

  // preferenceschange fires when the user clicks an action declared in
  // manifest.codegenPreferences. We use it as the user-initiated trigger
  // that finally lets us call figma.showUI() in Dev Mode.
  codegen.on(
    "preferenceschange",
    ((event: { propertyName: string }) => {
      if (event.propertyName === "open-plugin") {
        try {
          figma.showUI(__html__, { ...UI_SIZE, themeColors: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          figma.notify(`Failed to open plugin window: ${message}`, {
            error: true,
          });
        }
      }
    }) as never
  );
}

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------

function getSelectionState(): {
  hasValidSelection: boolean;
  selection: { id: string; name: string; type: string } | null;
} {
  const node = figma.currentPage.selection[0];
  const isValid =
    !!node && (ALLOWED_SELECTION_TYPES as ReadonlyArray<string>).includes(node.type);
  return {
    hasValidSelection: isValid,
    selection: node ? { id: node.id, name: node.name, type: node.type } : null,
  };
}

figma.on("selectionchange", () => {
  const s = getSelectionState();
  post({ type: "SELECTION_STATE", ...s });
});

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function loadMappings(): Promise<ComponentMapping[]> {
  try {
    const raw = await figma.clientStorage.getAsync(STORAGE_KEY_MAPPINGS);
    return Array.isArray(raw) ? (raw as ComponentMapping[]) : [];
  } catch {
    return [];
  }
}

async function saveMappings(list: ComponentMapping[]): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEY_MAPPINGS, list);
}

async function loadComponentCatalog(): Promise<FEComponentCatalogItem[]> {
  try {
    const raw = await figma.clientStorage.getAsync(STORAGE_KEY_COMPONENT_CATALOG);
    return Array.isArray(raw) ? (raw as FEComponentCatalogItem[]) : [];
  } catch {
    return [];
  }
}

async function loadTokenCatalog(): Promise<FETokenCatalogItem[]> {
  try {
    const raw = await figma.clientStorage.getAsync(STORAGE_KEY_TOKEN_CATALOG);
    return Array.isArray(raw) ? (raw as FETokenCatalogItem[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

figma.ui.onmessage = async (msg: UiToMain) => {
  await handleUiMessage(msg);
};

async function handleUiMessage(msg: UiToMain): Promise<void> {
  try {
    switch (msg.type) {
      case "INIT": {
        const [mappings, components, tokens] = await Promise.all([
          loadMappings(),
          loadComponentCatalog(),
          loadTokenCatalog(),
        ]);
        const s = getSelectionState();
        post({
          type: "INITIAL_STATE",
          mappings,
          ...s,
          catalogs: { components, tokens },
        });
        return;
      }

      case "GET_MAPPINGS": {
        const mappings = await loadMappings();
        post({ type: "MAPPINGS_UPDATED", mappings });
        return;
      }

      case "SAVE_MAPPING": {
        const list = await loadMappings();
        const idx = list.findIndex((m) => m.id === msg.mapping.id);
        const stamped: ComponentMapping = {
          ...msg.mapping,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) list[idx] = stamped;
        else list.push(stamped);
        await saveMappings(list);
        post({ type: "MAPPINGS_UPDATED", mappings: list });
        return;
      }

      case "DELETE_MAPPING": {
        const list = await loadMappings();
        const next = list.filter((m) => m.id !== msg.id);
        await saveMappings(next);
        post({ type: "MAPPINGS_UPDATED", mappings: next });
        return;
      }

      case "SET_CATALOGS": {
        if (msg.components) {
          await figma.clientStorage.setAsync(
            STORAGE_KEY_COMPONENT_CATALOG,
            msg.components
          );
        }
        if (msg.tokens) {
          await figma.clientStorage.setAsync(
            STORAGE_KEY_TOKEN_CATALOG,
            msg.tokens
          );
        }
        return;
      }

      case "SCAN_SELECTION": {
        const node = requireSelectedNode();
        post({ type: "PROGRESS", stage: "Scanning node tree…" });
        const summary = await summariseSelection(node);
        post({ type: "SCAN_RESULT", summary });
        return;
      }

      case "AUTOFILL_MAPPINGS": {
        const node = requireSelectedNode();
        const [mappings, components] = await Promise.all([
          loadMappings(),
          loadComponentCatalog(),
        ]);
        post({ type: "PROGRESS", stage: "Resolving INSTANCE nodes…" });
        const suggestions = await autofillSuggestions(node, mappings, components);
        post({ type: "AUTOFILL_RESULT", suggestions });
        return;
      }

      case "BUILD_SPEC": {
        const node = requireSelectedNode();
        const [mappings, components, tokens] = await Promise.all([
          loadMappings(),
          loadComponentCatalog(),
          loadTokenCatalog(),
        ]);
        post({ type: "PROGRESS", stage: "Building compressed spec…" });
        const spec = await buildCompressedSpec(node, mappings, components, tokens);
        post({ type: "PROGRESS", stage: "Building SpeX export bundle…" });
        const spex = await buildSpexBundle(node, mappings);
        post({ type: "SPEC_READY", spec, spex });
        return;
      }

      case "SET_NODE_MARK": {
        const n = await figma.getNodeByIdAsync(msg.nodeId);
        if (n && "setPluginData" in n) {
          (n as BaseNode).setPluginData(PLUGIN_DATA_MARK, msg.mark ?? "");
        }
        return;
      }

      case "ZOOM_TO_NODE": {
        const n = await figma.getNodeByIdAsync(msg.nodeId);
        if (n && n.type !== "DOCUMENT" && n.type !== "PAGE") {
          figma.viewport.scrollAndZoomIntoView([n as SceneNode]);
          if (!msg.preserveSelection) {
            figma.currentPage.selection = [n as SceneNode];
          }
        }
        return;
      }

      case "CREATE_COMPONENT_FROM_NODE": {
        const n = await figma.getNodeByIdAsync(msg.nodeId);
        if (!n || n.type === "DOCUMENT" || n.type === "PAGE") {
          throw new Error("Cannot create a component from this node.");
        }
        const previousSelection = figma.currentPage.selection.slice();
        const component = figma.createComponentFromNode(n as SceneNode);
        figma.viewport.scrollAndZoomIntoView([component]);
        const restored = previousSelection.filter((s) => s.parent !== null);
        if (restored.length) {
          figma.currentPage.selection = restored;
        }
        figma.notify(`Created component "${component.name}".`);
        post({ type: "PROGRESS", stage: `Created component "${component.name}". Scan again to refresh the tree.` });
        return;
      }

      case "ZOOM_TO_SELECTION": {
        const sel = figma.currentPage.selection;
        if (sel.length > 0) figma.viewport.scrollAndZoomIntoView(sel);
        return;
      }

      case "GET_FIGMA_COMPONENTS": {
        const names = await collectFigmaComponentNames();
        post({ type: "FIGMA_COMPONENTS", names });
        return;
      }

      case "EXPAND_SELECTION": {
        const sel = figma.currentPage.selection;
        if (sel.length === 0) return;
        const all: SceneNode[] = [];
        const seen = new Set<string>();
        for (const r of sel) collectVisibleDescendants(r, all, seen);
        if (all.length === 0) return;
        figma.currentPage.selection = all;
        figma.notify(
          `Expanded selection to ${all.length} node${all.length === 1 ? "" : "s"}.`
        );
        return;
      }

      case "CLOSE_PLUGIN":
        figma.closePlugin();
        return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "ERROR", error: message });
    figma.notify(message, { error: true });
  }
}

// ---------------------------------------------------------------------------
// Selection helper
// ---------------------------------------------------------------------------

function requireSelectedNode(): SceneNode {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    throw new Error(
      "Nothing is selected. Pick a frame, component, instance, section, or group."
    );
  }
  const node = sel[0];
  if (!ALLOWED_SELECTION_TYPES.includes(node.type)) {
    throw new Error(
      `Selected node type "${node.type}" is not supported. ` +
        `Supported: ${ALLOWED_SELECTION_TYPES.join(", ")}.`
    );
  }
  return node;
}

// ---------------------------------------------------------------------------
// Selection summary (for the Export tab "Scan" button)
// ---------------------------------------------------------------------------

async function summariseSelection(root: SceneNode): Promise<{
  nodes: number;
  instances: number;
  textNodes: number;
  tree: SelectionTreeNode | null;
  reviewComponents: ReviewComponent[];
  tokens: DesignTokenRef[];
  unmatchedInstances: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
    mainComponentKey?: string;
  }>;
}> {
  const mappings = await loadMappings();
  const components = await loadComponentCatalog();
  // Token extraction now runs as part of "scan selection" so the Tokens tab
  // refreshes immediately, without waiting for a full Build.
  const tokenCatalog = await loadTokenCatalog();
  const localVars = await loadLocalVariables();
  const tokens = new Map<string, DesignTokenRef>();

  let nodes = 0;
  let instances = 0;
  let textNodes = 0;
  const unmatched: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
    mainComponentKey?: string;
  }> = [];

  // Unique component rows for the Review & Export table.
  const reviewComponents: ReviewComponent[] = [];
  const reviewSeen = new Set<string>();

  // Recursive tree build + data collection in one pass.
  async function buildTree(n: SceneNode): Promise<SelectionTreeNode> {
    nodes++;
    if (n.type === "TEXT") textNodes++;

    // Collect design tokens (bound variables + text styles) for this node.
    await collectNodeTokens(n, tokens, tokenCatalog, localVars);

    let matched = false;
    let mappingName = n.name;
    let figmaComponentKey: string | undefined;
    let figmaComponentName: string | undefined;
    let codeComponent: string | undefined;
    let codeFilePath: string | undefined;
    let importType: "default" | "named" | undefined;
    let importName: string | undefined;

    if (n.type === "INSTANCE") {
      instances++;
      const mc = await tryGetMain(n as InstanceNode);
      const figmaName = mc?.name ?? n.name;
      mappingName = figmaName;
      figmaComponentKey = mc?.key;
      figmaComponentName = mc?.name;
      const m = matchMapping(
        { figmaName, figmaComponentKey: mc?.key, figmaNodeId: n.id },
        mappings,
        components
      );
      matched = !!m;
      codeComponent = m?.mapping.codeComponent;
      codeFilePath = m?.mapping.codeFilePath;
      importType = m?.mapping.importType;
      importName = m?.mapping.importName;
      if (!m) {
        unmatched.push({
          nodeId: n.id,
          name: n.name,
          figmaName,
          mainComponentKey: mc?.key,
        });
      }
      const key = mc?.key ?? figmaName;
      if (!reviewSeen.has(key)) {
        reviewSeen.add(key);
        reviewComponents.push({
          nodeId: n.id,
          name: figmaName,
          type: "INSTANCE",
          codeComponent: m ? m.mapping.codeComponent : null,
          codeFilePath: m ? m.mapping.codeFilePath : null,
        });
      }
    } else {
      const m = matchMapping(
        { figmaName: n.name, figmaNodeId: n.id },
        mappings,
        components
      );
      matched = !!m;
      codeComponent = m?.mapping.codeComponent;
      codeFilePath = m?.mapping.codeFilePath;
      importType = m?.mapping.importType;
      importName = m?.mapping.importName;
    }

    const treeNode: SelectionTreeNode = {
      id: n.id,
      name: n.name,
      type: n.type,
      isInstance: n.type === "INSTANCE",
      matched,
      mappingName,
      figmaComponentKey,
      figmaComponentName,
      codeComponent,
      codeFilePath,
      importType,
      importName,
    };

    if ("children" in n) {
      const kids: SelectionTreeNode[] = [];
      for (const c of (n as ChildrenMixin).children as SceneNode[]) {
        kids.push(await buildTree(c));
      }
      if (kids.length) treeNode.children = kids;
    }
    return treeNode;
  }

  const tree = await buildTree(root);

  // The selected root is always the first row of the review table.
  let rootCode: { codeComponent: string | null; codeFilePath: string | null } = {
    codeComponent: null,
    codeFilePath: null,
  };
  if (root.type === "INSTANCE") {
    const mc = await tryGetMain(root as InstanceNode);
    const m = matchMapping(
      { figmaName: mc?.name ?? root.name, figmaComponentKey: mc?.key, figmaNodeId: root.id },
      mappings,
      components
    );
    if (m) {
      rootCode = {
        codeComponent: m.mapping.codeComponent,
        codeFilePath: m.mapping.codeFilePath,
      };
    }
  }
  reviewComponents.unshift({
    nodeId: root.id,
    name: root.name,
    type: root.type,
    codeComponent: rootCode.codeComponent,
    codeFilePath: rootCode.codeFilePath,
  });

  return {
    nodes,
    instances,
    textNodes,
    tree,
    reviewComponents,
    tokens: Array.from(tokens.values()),
    unmatchedInstances: unmatched,
  };
}

// Collects component names that exist in the Figma file, used to power the
// "Figma Name" autocomplete in the Component Records Manager.
//
// Sources, in priority order:
//   1. The current selection subtree -- every INSTANCE node's own name, every
//      INSTANCE's resolved main component, and any COMPONENT / COMPONENT_SET
//      directly in the tree. This guarantees everything the user can see in
//      what they selected appears in the dropdown.
//   2. Every COMPONENT_SET / standalone COMPONENT in the whole document, so
//      the user can also map components that aren't in the current selection.
async function collectFigmaComponentNames(): Promise<string[]> {
  const names = new Set<string>();

  // ---- 1. Walk the current selection subtree --------------------------------
  const visit = async (n: SceneNode): Promise<void> => {
    if (n.type === "INSTANCE") {
      // The instance node's own name is what shows in the layers panel and in
      // the exported JSON (e.g. "Badge") -- always include it.
      if (n.name) names.add(n.name);
      try {
        const mc = await (n as InstanceNode).getMainComponentAsync();
        if (mc) {
          if (mc.parent && mc.parent.type === "COMPONENT_SET") {
            names.add(mc.parent.name);
          } else if (mc.name) {
            names.add(mc.name);
          }
        }
      } catch {
        /* ignore unresolvable instance */
      }
    } else if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") {
      if (n.name) names.add(n.name);
    }
    if ("children" in n) {
      for (const c of (n as ChildrenMixin).children as SceneNode[]) {
        await visit(c);
      }
    }
  };
  try {
    for (const sel of figma.currentPage.selection) {
      await visit(sel);
    }
  } catch {
    /* ignore */
  }

  // ---- 2. All components defined anywhere in the document -------------------
  try {
    const found = figma.root.findAllWithCriteria({
      types: ["COMPONENT", "COMPONENT_SET"],
    });
    for (const c of found) {
      // Skip variant children of a set -- the set name is friendlier.
      if (c.type === "COMPONENT" && c.parent && c.parent.type === "COMPONENT_SET") {
        continue;
      }
      if (c.name) names.add(c.name);
    }
  } catch {
    /* findAllWithCriteria unavailable or page not loaded — ignore */
  }

  return Array.from(names)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

// Collects design tokens used by a single node: bound variables on fills /
// strokes / corner radius, drop-shadow effects, and the node's text style.
// Mutates the shared `tokens` map (deduped by variable id / style name).
async function collectNodeTokens(
  n: SceneNode,
  tokens: Map<string, DesignTokenRef>,
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>,
  localVars: Map<string, Variable>
): Promise<void> {
  const regVar = (v: Variable, type: TokenKind, rawValue: unknown): void => {
    const key = `var:${v.id}`;
    const existing = tokens.get(key);
    if (existing) {
      existing.usageCount++;
      return;
    }
    const match = matchTokenName(v.name, tokenCatalog);
    tokens.set(key, {
      figmaTokenName: v.name,
      figmaVariableId: v.id,
      type,
      value: rawValue,
      codeTokenName: match?.name,
      codeTokenPath: match?.filePath,
      confidence: match?.score,
      usageCount: 1,
    });
  };

  const anyN = n as unknown as {
    fills?: ReadonlyArray<Paint> | symbol;
    strokes?: ReadonlyArray<Paint>;
    cornerRadius?: number | symbol;
    effects?: ReadonlyArray<Effect>;
  };

  if (Array.isArray(anyN.fills)) {
    (anyN.fills as Paint[]).forEach((p, i) => {
      const ref = bindingForField(n, `fills.${i}`);
      const v = ref ? localVars.get(ref) : null;
      if (v) regVar(v, "color", p);
    });
  }
  if (Array.isArray(anyN.strokes)) {
    (anyN.strokes as Paint[]).forEach((p, i) => {
      const ref = bindingForField(n, `strokes.${i}`);
      const v = ref ? localVars.get(ref) : null;
      if (v) regVar(v, "color", p);
    });
  }
  if (typeof anyN.cornerRadius === "number") {
    const ref = bindingForField(n, "cornerRadius");
    const v = ref ? localVars.get(ref) : null;
    if (v) regVar(v, "radius", anyN.cornerRadius);
  }
  if (Array.isArray(anyN.effects)) {
    for (const e of anyN.effects as Effect[]) {
      const key = `effect:${JSON.stringify(e)}`;
      const existing = tokens.get(key);
      if (existing) {
        existing.usageCount++;
        continue;
      }
      tokens.set(key, {
        figmaTokenName: `effect/${e.type.toLowerCase()}`,
        type: "shadow",
        value: e,
        usageCount: 1,
      });
    }
  }

  if (n.type === "TEXT") {
    try {
      const sid = (n as unknown as { textStyleId?: string | symbol }).textStyleId;
      if (typeof sid === "string" && sid) {
        const style = await figma.getStyleByIdAsync(sid);
        if (style) {
          const key = `typo:${style.name}`;
          const existing = tokens.get(key);
          if (existing) {
            existing.usageCount++;
          } else {
            const match = matchTokenName(style.name, tokenCatalog);
            tokens.set(key, {
              figmaTokenName: style.name,
              figmaStyleId: sid,
              type: "typography",
              value: { name: style.name },
              codeTokenName: match?.name,
              codeTokenPath: match?.filePath,
              confidence: match?.score,
              usageCount: 1,
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}

async function walkAsync(
  n: SceneNode,
  visit: (n: SceneNode) => Promise<void> | void
): Promise<void> {
  await visit(n);
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      await walkAsync(c, visit);
    }
  }
}

async function tryGetMain(n: InstanceNode): Promise<ComponentNode | null> {
  try {
    return await n.getMainComponentAsync();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Matcher — priorities P1..P5
// ---------------------------------------------------------------------------

interface MatchInput {
  figmaName: string;
  figmaNodeId?: string;
  figmaComponentKey?: string;
}

interface MatchResult {
  mapping: ComponentMapping;
  confidence: number;
  reason: string;
}

function matchMapping(
  input: MatchInput,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>
): MatchResult | null {
  // P1: exact figmaNodeId
  if (input.figmaNodeId) {
    const hit = mappings.find((m) => m.figmaNodeId === input.figmaNodeId);
    if (hit) {
      return { mapping: hit, confidence: hit.confidence || 1, reason: "node-id-match" };
    }
  }

  // P2: exact figmaComponentKey
  if (input.figmaComponentKey) {
    const hit = mappings.find(
      (m) => m.figmaComponentKey === input.figmaComponentKey
    );
    if (hit) {
      return { mapping: hit, confidence: hit.confidence || 1, reason: "key-match" };
    }
  }

  // P3: exact figmaName
  const exact = mappings.find((m) => m.figmaName === input.figmaName);
  if (exact) {
    return {
      mapping: exact,
      confidence: exact.confidence || 0.95,
      reason: "name-exact",
    };
  }

  // P4: normalised name match (case + separators ignored)
  const norm = normaliseName(input.figmaName);
  const normHit = mappings.find((m) => normaliseName(m.figmaName) === norm);
  if (normHit) {
    return {
      mapping: normHit,
      confidence: Math.max(0.8, normHit.confidence ?? 0),
      reason: "name-normalised",
    };
  }

  // P5: catalog-derived synthetic mapping (auto-suggested, name-based)
  const catalogHit = bestCatalogMatch(input.figmaName, components);
  if (catalogHit) {
    const synthetic: ComponentMapping = {
      id: `auto:${catalogHit.item.componentName}`,
      figmaName: input.figmaName,
      figmaComponentKey: input.figmaComponentKey,
      codeComponent: catalogHit.item.componentName,
      codeFilePath: catalogHit.item.filePath,
      importType: catalogHit.item.exportType,
      importName: catalogHit.item.componentName,
      confidence: catalogHit.score,
      source: "auto-suggested",
      updatedAt: new Date().toISOString(),
    };
    return {
      mapping: synthetic,
      confidence: catalogHit.score,
      reason: catalogHit.reason,
    };
  }

  return null;
}

function normaliseName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function bestCatalogMatch(
  figmaName: string,
  components: ReadonlyArray<FEComponentCatalogItem>
): { item: FEComponentCatalogItem; score: number; reason: string } | null {
  if (!components.length) return null;
  const target = normaliseName(figmaName);
  let best: { item: FEComponentCatalogItem; score: number; reason: string } | null = null;
  for (const c of components) {
    const candidates = [c.componentName, ...(c.aliases ?? [])];
    for (const cand of candidates) {
      const cn = normaliseName(cand);
      if (!cn) continue;
      let score = 0;
      let reason = "";
      if (cn === target) { score = 0.9; reason = "catalog-exact"; }
      else if (target.includes(cn) || cn.includes(target)) {
        score = 0.7; reason = "catalog-substring";
      } else {
        const sim = diceCoefficient(cn, target);
        if (sim >= 0.6) { score = 0.4 + sim * 0.4; reason = `catalog-fuzzy(${sim.toFixed(2)})`; }
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { item: c, score, reason };
      }
    }
  }
  return best;
}

function diceCoefficient(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let intersection = 0;
  for (const [bg, count] of A) {
    if (B.has(bg)) intersection += Math.min(count, B.get(bg)!);
  }
  const total = (a.length - 1) + (b.length - 1);
  return total <= 0 ? 0 : (2 * intersection) / total;
}

// ---------------------------------------------------------------------------
// Auto-fill suggestions (returned to the UI for the user to review)
// ---------------------------------------------------------------------------

async function autofillSuggestions(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>
): Promise<AutofillSuggestion[]> {
  const seen = new Map<string, AutofillSuggestion>();
  await walkAsync(root, async (n) => {
    if (n.type !== "INSTANCE") return;
    const mc = await tryGetMain(n as InstanceNode);
    const figmaName = mc?.name ?? n.name;
    const key = mc?.key ?? figmaName;
    if (seen.has(key)) return;

    const exact = matchMapping(
      { figmaName, figmaComponentKey: mc?.key, figmaNodeId: n.id },
      mappings,
      components
    );

    // Top up to 3 catalog candidates by score.
    const ranked: AutofillSuggestion["candidates"] = [];
    if (exact) {
      ranked.push({
        codeComponent: exact.mapping.codeComponent,
        codeFilePath: exact.mapping.codeFilePath,
        confidence: exact.confidence,
        reason: exact.reason,
      });
    }
    for (const c of components) {
      const cn = normaliseName(c.componentName);
      const target = normaliseName(figmaName);
      const sim = diceCoefficient(cn, target);
      if (sim < 0.4) continue;
      if (ranked.some((r) => r.codeComponent === c.componentName)) continue;
      ranked.push({
        codeComponent: c.componentName,
        codeFilePath: c.filePath,
        confidence: 0.3 + sim * 0.5,
        reason: `catalog-fuzzy(${sim.toFixed(2)})`,
      });
    }
    ranked.sort((a, b) => b.confidence - a.confidence);

    seen.set(key, {
      figmaName,
      figmaNodeId: n.id,
      figmaComponentKey: mc?.key,
      candidates: ranked.slice(0, 3),
    });
  });

  return Array.from(seen.values()).sort((a, b) =>
    a.figmaName.localeCompare(b.figmaName)
  );
}

// ---------------------------------------------------------------------------
// Compressed spec builder (Match + Prune + Tokens + Assets)
// ---------------------------------------------------------------------------

async function buildCompressedSpec(
  root: SceneNode,
  mappings: ReadonlyArray<ComponentMapping>,
  components: ReadonlyArray<FEComponentCatalogItem>,
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>
): Promise<CompressedSpec> {
  const localVars = await loadLocalVariables();
  const ctx: BuildCtx = {
    mappings,
    components,
    tokenCatalog,
    localVars,
    tokens: new Map(),
    assets: [],
    matched: 0,
    unmatched: 0,
    ignored: 0,
    totalInstances: 0,
    confidenceSum: 0,
    matchedDetails: [],
    unmatchedDetails: [],
    componentsUsed: new Map(),
  };

  const root_spec = await buildNode(root, ctx, /* isRoot */ true);

  const matchedAvg = ctx.matched ? ctx.confidenceSum / ctx.matched : 0;
  const tokenCoverage =
    ctx.tokens.size === 0
      ? 1
      : Array.from(ctx.tokens.values()).filter((t) => t.codeTokenName).length /
        ctx.tokens.size;

  const report: MappingReport = {
    matched: ctx.matched,
    unmatched: ctx.unmatched,
    ignored: ctx.ignored,
    totalInstances: ctx.totalInstances,
    tokenCoverage,
    confidence: matchedAvg,
    matchedDetails: ctx.matchedDetails,
    unmatchedDetails: ctx.unmatchedDetails,
    missingTokens: Array.from(ctx.tokens.values())
      .filter((t) => !t.codeTokenName)
      .map((t) => ({ figmaTokenName: t.figmaTokenName, type: t.type })),
  };

  return {
    version: PLUGIN_VERSION,
    source: "figma-to-vscode-sender",
    createdAt: new Date().toISOString(),
    figma: {
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      selectedNodeId: root.id,
      selectedNodeName: root.name,
    },
    screen: {
      name: root.name,
      width: "width" in root ? root.width : 0,
      height: "height" in root ? root.height : 0,
      children: Array.isArray((root_spec as LayoutSpec).children)
        ? ((root_spec as LayoutSpec).children as SpecNode[])
        : [root_spec],
    },
    componentsUsed: Array.from(ctx.componentsUsed.values()),
    tokens: Array.from(ctx.tokens.values()),
    assets: ctx.assets,
    mappingReport: report,
  };
}

interface BuildCtx {
  mappings: ReadonlyArray<ComponentMapping>;
  components: ReadonlyArray<FEComponentCatalogItem>;
  tokenCatalog: ReadonlyArray<FETokenCatalogItem>;
  localVars: Map<string, Variable>;

  tokens: Map<string, DesignTokenRef>;
  assets: AssetRef[];

  matched: number;
  unmatched: number;
  ignored: number;
  totalInstances: number;
  confidenceSum: number;
  matchedDetails: MappingReport["matchedDetails"];
  unmatchedDetails: MappingReport["unmatchedDetails"];
  componentsUsed: Map<
    string,
    {
      figmaName: string;
      codeComponent: string;
      codeFilePath: string;
      importType: "default" | "named";
      importName?: string;
      confidence: number;
      occurrences: number;
    }
  >;
}

async function buildNode(
  n: SceneNode,
  ctx: BuildCtx,
  // When true, this is the node the user explicitly selected. We never prune
  // the root: even if it matches a mapping, we serialize its full subtree so
  // the user sees the content, not just a single component_ref wrapper.
  isRoot: boolean = false
): Promise<SpecNode> {
  // Visibility & ignore mark
  if (!("visible" in n) || n.visible === false) {
    // Fall through but mark as ignored layout node; could also drop entirely.
  }

  const mark = getMark(n);
  if (mark === "ignored") {
    ctx.ignored++;
    return {
      type: "layout_node",
      name: n.name,
      figmaNodeId: n.id,
      figmaType: n.type,
    };
  }

  // Asset marks short-circuit children and produce an asset_ref.
  if (mark === "icon" || mark === "image" || mark === "vector") {
    const ref = await exportAssetForNode(n, mark, ctx);
    if (ref) {
      const spec: AssetRefSpec = {
        type: "asset_ref",
        assetType: mark,
        name: ref.name,
        path: ref.path,
        figmaNodeId: n.id,
      };
      return spec;
    }
  }

  // INSTANCE → mapping?
  // For the user-selected root, we deliberately skip the prune-to-ref path
  // and treat it like a layout node so the full content is visible. Nested
  // INSTANCEs further down are still pruned normally.
  if (n.type === "INSTANCE" && !isRoot) {
    ctx.totalInstances++;
    const mc = await tryGetMain(n as InstanceNode);
    const figmaName = mc?.name ?? n.name;
    const match = matchMapping(
      { figmaName, figmaComponentKey: mc?.key, figmaNodeId: n.id },
      ctx.mappings,
      ctx.components
    );

    if (match) {
      ctx.matched++;
      ctx.confidenceSum += match.confidence;
      ctx.matchedDetails.push({
        figmaName,
        codeComponent: match.mapping.codeComponent,
        confidence: match.confidence,
      });

      const key = match.mapping.codeComponent + "@" + match.mapping.codeFilePath;
      const existing = ctx.componentsUsed.get(key);
      if (existing) existing.occurrences++;
      else {
        ctx.componentsUsed.set(key, {
          figmaName,
          codeComponent: match.mapping.codeComponent,
          codeFilePath: match.mapping.codeFilePath,
          importType: match.mapping.importType,
          importName: match.mapping.importName,
          confidence: match.confidence,
          occurrences: 1,
        });
      }

      const props = await extractInstanceProps(
        n as InstanceNode,
        match.mapping,
        ctx
      );

      const spec: ComponentRefSpec = {
        type: "component_ref",
        figmaName,
        figmaNodeId: n.id,
        codeComponent: match.mapping.codeComponent,
        codeFilePath: match.mapping.codeFilePath,
        importType: match.mapping.importType,
        importName: match.mapping.importName,
        props,
        pruned: true,
        confidence: match.confidence,
      };
      // Don't descend into children — they are implementation details of the
      // matched code component.
      return spec;
    } else {
      ctx.unmatched++;
      ctx.unmatchedDetails.push({
        figmaName,
        figmaType: n.type,
        nodeId: n.id,
      });
      // Fall through and treat as a layout node so the design intent isn't lost.
    }
  }

  // TEXT → text_node with typography token
  if (n.type === "TEXT") {
    return await buildTextNode(n as TextNode, ctx);
  }

  // Default → layout_node with extracted layout + (compact) styles + recurse
  const layout = extractLayout(n);
  const styles = await extractStylesWithTokens(n, ctx);
  const children: SpecNode[] = [];
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      children.push(await buildNode(c, ctx));
    }
  }
  const spec: LayoutSpec = {
    type: "layout_node",
    name: n.name,
    figmaNodeId: n.id,
    figmaType: n.type,
    layout,
    styles,
    children: children.length ? children : undefined,
  };
  return spec;
}

function extractLayout(n: SceneNode): Record<string, unknown> | undefined {
  if (!("layoutMode" in n)) return undefined;
  const m = n as unknown as {
    layoutMode?: string;
    itemSpacing?: number;
    paddingLeft?: number; paddingRight?: number;
    paddingTop?: number; paddingBottom?: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    primaryAxisSizingMode?: string;
    counterAxisSizingMode?: string;
    layoutWrap?: string;
  };
  if (!m.layoutMode || m.layoutMode === "NONE") return undefined;
  return {
    display: "flex",
    direction: m.layoutMode === "HORIZONTAL" ? "row" : "column",
    gap: m.itemSpacing,
    padding: {
      left: m.paddingLeft, right: m.paddingRight,
      top: m.paddingTop, bottom: m.paddingBottom,
    },
    justify: m.primaryAxisAlignItems,
    align: m.counterAxisAlignItems,
    wrap: m.layoutWrap,
    sizing: {
      primary: m.primaryAxisSizingMode,
      counter: m.counterAxisSizingMode,
    },
  };
}

async function extractStylesWithTokens(
  n: SceneNode,
  ctx: BuildCtx
): Promise<Record<string, unknown> | undefined> {
  const anyN = n as unknown as {
    fills?: ReadonlyArray<Paint> | symbol;
    strokes?: ReadonlyArray<Paint>;
    strokeWeight?: number | symbol;
    cornerRadius?: number | symbol;
    effects?: ReadonlyArray<Effect>;
    opacity?: number;
    boundVariables?: Record<string, unknown>;
  };

  const hasAny =
    "fills" in n || "strokes" in n || "cornerRadius" in n || "effects" in n;
  if (!hasAny) return undefined;

  const out: Record<string, unknown> = {};

  if (Array.isArray(anyN.fills)) {
    out.fills = (anyN.fills as Paint[]).map((p, i) =>
      paintWithToken(p, n, "fills", i, ctx)
    );
  }
  if (Array.isArray(anyN.strokes)) {
    out.strokes = (anyN.strokes as Paint[]).map((p, i) =>
      paintWithToken(p, n, "strokes", i, ctx)
    );
  }
  if (typeof anyN.strokeWeight === "number") out.strokeWeight = anyN.strokeWeight;
  if (typeof anyN.cornerRadius === "number") {
    out.cornerRadius = cornerRadiusWithToken(
      anyN.cornerRadius,
      n,
      "cornerRadius",
      ctx
    );
  }
  if (Array.isArray(anyN.effects) && anyN.effects.length) {
    out.effects = anyN.effects.map((e) => ({
      kind: e.type,
      raw: e,
    }));
    for (const e of anyN.effects) {
      registerEffectToken(e, ctx);
    }
  }
  if (typeof anyN.opacity === "number" && anyN.opacity !== 1) {
    out.opacity = anyN.opacity;
  }
  return out;
}

function paintWithToken(
  p: Paint,
  node: SceneNode,
  field: string,
  index: number,
  ctx: BuildCtx
): Record<string, unknown> {
  const ref = bindingForField(node, `${field}.${index}`);
  const variable = ref ? ctx.localVars.get(ref) : null;
  if (variable) {
    const tok = registerVariableToken(variable, "color", ctx, p);
    return { tokenRef: tok.figmaTokenName, raw: p };
  }
  if (p.type === "SOLID") {
    return { hex: rgbToHex(p.color, p.opacity ?? 1), raw: p };
  }
  return { raw: p };
}

function cornerRadiusWithToken(
  value: number,
  node: SceneNode,
  field: string,
  ctx: BuildCtx
): unknown {
  const ref = bindingForField(node, field);
  const variable = ref ? ctx.localVars.get(ref) : null;
  if (variable) {
    const tok = registerVariableToken(variable, "radius", ctx, value);
    return { tokenRef: tok.figmaTokenName, raw: value };
  }
  return value;
}

function bindingForField(node: SceneNode, field: string): string | null {
  try {
    const bv = (node as unknown as { boundVariables?: Record<string, unknown> })
      .boundVariables;
    if (!bv) return null;
    // boundVariables can be nested like { fills: [{type:'VARIABLE_ALIAS', id}] }
    const path = field.split(".");
    let cur: unknown = bv;
    for (const seg of path) {
      if (cur && typeof cur === "object") {
        const idx = Number(seg);
        cur = !isNaN(idx)
          ? (cur as unknown[])[idx]
          : (cur as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    if (cur && typeof cur === "object" && (cur as { id?: string }).id) {
      return (cur as { id: string }).id;
    }
    return null;
  } catch {
    return null;
  }
}

function registerVariableToken(
  v: Variable,
  type: TokenKind,
  ctx: BuildCtx,
  rawValue: unknown
): DesignTokenRef {
  const key = `var:${v.id}`;
  const existing = ctx.tokens.get(key);
  if (existing) {
    existing.usageCount++;
    return existing;
  }
  const match = matchTokenName(v.name, ctx.tokenCatalog);
  const ref: DesignTokenRef = {
    figmaTokenName: v.name,
    figmaVariableId: v.id,
    type,
    value: rawValue,
    codeTokenName: match?.name,
    codeTokenPath: match?.filePath,
    confidence: match?.score,
    usageCount: 1,
  };
  ctx.tokens.set(key, ref);
  return ref;
}

function registerEffectToken(e: Effect, ctx: BuildCtx): void {
  // Effects styles via styleId would require figma.getStyleByIdAsync; we
  // skip the round-trip and key by canonical JSON for dedupe stats.
  const key = `effect:${JSON.stringify(e)}`;
  const existing = ctx.tokens.get(key);
  if (existing) {
    existing.usageCount++;
    return;
  }
  ctx.tokens.set(key, {
    figmaTokenName: `effect/${e.type.toLowerCase()}`,
    type: "shadow",
    value: e,
    usageCount: 1,
  });
}

function matchTokenName(
  figmaName: string,
  catalog: ReadonlyArray<FETokenCatalogItem>
): { name: string; filePath?: string; score: number } | null {
  if (!catalog.length) return null;
  const target = normaliseName(figmaName);
  let best: { name: string; filePath?: string; score: number } | null = null;
  for (const t of catalog) {
    const sim = diceCoefficient(normaliseName(t.name), target);
    if (sim < 0.55) continue;
    if (!best || sim > best.score) {
      best = { name: t.name, filePath: t.filePath, score: sim };
    }
  }
  return best;
}

function rgbToHex(c: RGB, a: number): string {
  const ch = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  const hex = `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
  return a < 1 ? `${hex}${ch(a)}` : hex;
}

async function buildTextNode(n: TextNode, ctx: BuildCtx): Promise<TextSpec> {
  const family =
    typeof n.fontName === "object" ? n.fontName.family : undefined;
  const style =
    typeof n.fontName === "object" ? n.fontName.style : undefined;

  // Try fillStyleId for typography token name.
  let tokenRef: string | undefined;
  try {
    const sid = (n as unknown as { textStyleId?: string | symbol }).textStyleId;
    if (typeof sid === "string" && sid) {
      const style = await figma.getStyleByIdAsync(sid);
      if (style) tokenRef = style.name;
    }
  } catch { /* ignore */ }

  if (tokenRef) {
    const key = `typo:${tokenRef}`;
    if (!ctx.tokens.has(key)) {
      ctx.tokens.set(key, {
        figmaTokenName: tokenRef,
        type: "typography",
        value: { family, style, size: n.fontSize },
        usageCount: 1,
        ...(matchTokenName(tokenRef, ctx.tokenCatalog) ?? {}),
      });
    } else {
      ctx.tokens.get(key)!.usageCount++;
    }
  }

  return {
    type: "text_node",
    name: n.name,
    figmaNodeId: n.id,
    text: typeof n.characters === "string" ? n.characters : "",
    typography: {
      tokenRef,
      raw: {
        family,
        style,
        size: typeof n.fontSize === "number" ? n.fontSize : undefined,
        lineHeight: typeof n.lineHeight === "object" ? n.lineHeight : undefined,
        letterSpacing:
          typeof n.letterSpacing === "object" ? n.letterSpacing : undefined,
        align: n.textAlignHorizontal,
        valign: n.textAlignVertical,
        case: n.textCase,
        decoration: n.textDecoration,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

async function loadLocalVariables(): Promise<Map<string, Variable>> {
  const map = new Map<string, Variable>();
  try {
    const fn = (figma.variables as unknown as {
      getLocalVariablesAsync?: () => Promise<Variable[]>;
    }).getLocalVariablesAsync;
    let list: Variable[] = [];
    if (typeof fn === "function") list = await fn.call(figma.variables);
    else if (typeof figma.variables.getLocalVariables === "function")
      list = figma.variables.getLocalVariables();
    for (const v of list) map.set(v.id, v);
  } catch { /* ignore */ }
  return map;
}

// ---------------------------------------------------------------------------
// Instance props extraction
// ---------------------------------------------------------------------------

async function extractInstanceProps(
  n: InstanceNode,
  mapping: ComponentMapping,
  ctx: BuildCtx
): Promise<Record<string, unknown>> {
  const props: Record<string, unknown> = { ...(mapping.defaultProps ?? {}) };

  // Variant + component properties as raw bag
  let raw: Record<string, unknown> = {};
  try {
    raw = { ...((n.componentProperties as unknown) as Record<string, unknown>) };
  } catch { /* ignore */ }
  try {
    const variantProps = (n as unknown as { variantProperties?: unknown })
      .variantProperties;
    if (variantProps && typeof variantProps === "object") {
      raw = { ...raw, ...(variantProps as Record<string, unknown>) };
    }
  } catch { /* ignore */ }

  // Property values from componentProperties have shape { value, type, ... }.
  for (const [k, v] of Object.entries(raw)) {
    const codeKey = mapping.propMapping?.[k] ?? camelCase(k);
    const flat = (v as { value?: unknown })?.value !== undefined
      ? (v as { value: unknown }).value
      : v;
    props[codeKey] = flat;
  }

  // Merge first text child as `children` when requested.
  if (mapping.mergeChildProps) {
    const firstText = findFirstText(n);
    if (firstText && !("children" in props)) {
      props.children = firstText;
    }
  }

  // Avoid noise from unused tokens — but record usage for the report.
  void ctx; // ctx kept for future prop→token resolution
  return props;
}

function findFirstText(n: SceneNode): string | null {
  if (n.type === "TEXT" && typeof n.characters === "string") return n.characters;
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      const r = findFirstText(c);
      if (r) return r;
    }
  }
  return null;
}

function camelCase(s: string): string {
  return s
    .replace(/^[^a-zA-Z]+/, "")
    .replace(/[#].*$/, "") // strip Figma's "label#1:2" suffix
    .replace(/[^a-zA-Z0-9]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

// ---------------------------------------------------------------------------
// Asset marking + export
// ---------------------------------------------------------------------------

function getMark(n: SceneNode): AssetMark {
  try {
    const v = n.getPluginData(PLUGIN_DATA_MARK);
    if (!v) return null;
    if (
      v === "icon" || v === "image" || v === "vector" ||
      v === "illustration" || v === "decorative" || v === "ignored"
    ) return v;
    return null;
  } catch {
    return null;
  }
}

async function exportAssetForNode(
  n: SceneNode,
  kind: "icon" | "image" | "vector",
  ctx: BuildCtx
): Promise<AssetRef | null> {
  try {
    if (!("exportAsync" in n)) return null;
    const format: "svg" | "png" = kind === "image" ? "png" : "svg";
    const data =
      format === "svg"
        ? await (n as ExportMixin).exportAsync({ format: "SVG" })
        : await (n as ExportMixin).exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 2 },
          });
    const name = slugify(n.name) || "asset";
    const folder = kind === "icon" ? "icons" : kind === "vector" ? "vectors" : "images";
    const path = `@${folder}/${name}.${format}`;
    const ref: AssetRef = {
      type: kind,
      name,
      path,
      figmaNodeId: n.id,
      base64: uint8ToBase64(data),
      format,
    };
    ctx.assets.push(ref);
    return ref;
  } catch {
    return null;
  }
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Walks a node and pushes the node itself plus every visible descendant.
// Hidden subtrees are skipped because selecting them confuses the user (they
// can't see what's highlighted in the viewport).
function collectVisibleDescendants(
  n: SceneNode,
  out: SceneNode[],
  seen: Set<string>
): void {
  if (seen.has(n.id)) return;
  if (n.visible === false) return;
  seen.add(n.id);
  out.push(n);
  if ("children" in n) {
    for (const c of (n as ChildrenMixin).children as SceneNode[]) {
      collectVisibleDescendants(c, out, seen);
    }
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}
