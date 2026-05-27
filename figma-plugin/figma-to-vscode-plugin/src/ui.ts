// ui.ts — Figma plugin UI controller (MVP 1–5).
//
// Owns:
//   - Persistent WebSocket to VS Code (with handshake + auto-reconnect).
//   - 6 tabs: Connection, Export, Mappings, Tokens, Assets, Report.
//   - Forms for Component Mapping CRUD (persisted in code.ts/clientStorage).
//   - Sending the CompressedSpec produced by code.ts on "Send to VS Code".

import {
  AssetMark,
  AutofillSuggestion,
  ComponentMapping,
  CompressedSpec,
  DesignTokenRef,
  FEComponentCatalogItem,
  FETokenCatalogItem,
  MainToUi,
  PLUGIN_NAME,
  PLUGIN_VERSION,
  SelectionTreeNode,
  SpexBundleInfo,
  UiToMain,
  VsCodeDesignSpecPayload,
  WsIn,
  WsOut,
} from "./types";
import JSZip from "jszip";

// ---------- DOM helpers ----------------------------------------------------

const $ = <T extends Element>(id: string): T =>
  document.getElementById(id) as unknown as T;

type ElProps = Record<string, unknown> & {
  class?: string;
  style?: string;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === "class" && typeof v === "string") node.className = v;
    else if (k === "style" && typeof v === "string") node.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function")
      (node as unknown as Record<string, unknown>)[k] = v;
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

// ---------- State ----------------------------------------------------------

interface AppState {
  selection: { id: string; name: string; type: string } | null;
  mappings: ComponentMapping[];
  catalogs: {
    components: FEComponentCatalogItem[];
    tokens: FETokenCatalogItem[];
  };
  lastSpec: CompressedSpec | null;
  lastSpex: SpexBundleInfo | null;
  lastUnmatched: Array<{
    nodeId: string;
    name: string;
    figmaName: string;
  }>;
  ws: {
    status: "offline" | "connecting" | "open" | "handshaken";
    handshake?: { projectName: string; framework?: string };
    lastSyncAt?: string;
  };
}

const state: AppState = {
  selection: null,
  mappings: [],
  catalogs: { components: [], tokens: [] },
  lastSpec: null,
  lastSpex: null,
  lastUnmatched: [],
  ws: { status: "offline" },
};

// ---------- Postbox to main runtime ----------------------------------------

function send(msg: UiToMain): void {
  parent.postMessage({ pluginMessage: msg }, "*");
}

// ---------- Tabs -----------------------------------------------------------

document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Selection card -------------------------------------------------

const selectionName = $<HTMLDivElement>("selection-name");
const selectionSub = $<HTMLDivElement>("selection-sub");
const selectionIcon = $<HTMLDivElement>("selection-icon");
const iconCheck = $<SVGElement>("icon-check");
const iconEmpty = $<SVGElement>("icon-empty");
const zoomBtn = $<HTMLButtonElement>("zoom-btn");
const expandBtn = $<HTMLButtonElement>("expand-btn");

zoomBtn.addEventListener("click", () => send({ type: "ZOOM_TO_SELECTION" }));
expandBtn.addEventListener("click", () => send({ type: "EXPAND_SELECTION" }));

function renderSelection(sel: AppState["selection"]): void {
  const prevId = state.selection?.id;
  state.selection = sel;
  if (sel) {
    selectionName.textContent = sel.name;
    selectionSub.textContent = `${prettyType(sel.type)} selected for export`;
    selectionIcon.classList.remove("empty");
    iconCheck.style.display = "";
    iconEmpty.style.display = "none";
    zoomBtn.disabled = false;
    expandBtn.disabled = false;
  } else {
    selectionName.textContent = "No selection";
    selectionSub.textContent = "Select a frame / component / instance / section / group";
    selectionIcon.classList.add("empty");
    iconCheck.style.display = "none";
    iconEmpty.style.display = "";
    zoomBtn.disabled = true;
    expandBtn.disabled = true;
  }
  updateExportButtons();

  // Selection changed: drop stale review data and auto-scan the new node so
  // the Export tab tree is always current.
  if (sel?.id !== prevId) {
    closeReviewView();
    if (sel) {
      send({ type: "SCAN_SELECTION" });
    } else {
      lastReviewComponents = [];
      renderSelectionTree(null);
      renderUnmatched([]);
      reviewExportBtn.disabled = true;
    }
  }
}

function prettyType(t: string): string {
  return ({
    COMPONENT: "Component",
    COMPONENT_SET: "Component set",
    INSTANCE: "Instance",
    FRAME: "Frame",
    GROUP: "Group",
    SECTION: "Section",
  } as Record<string, string>)[t] ?? t.toLowerCase();
}

// ---------- Connection pill + handshake -----------------------------------

const connPill = $<HTMLSpanElement>("conn-pill");
const connLabel = $<HTMLSpanElement>("conn-label");
const handshakeInfo = $<HTMLDivElement>("handshake-info");
const catalogInfo = $<HTMLDivElement>("catalog-info");
const connStatus = $<HTMLDivElement>("conn-status");

function setConnUi(): void {
  connPill.classList.remove("ok", "warn", "err");
  switch (state.ws.status) {
    case "open":
    case "handshaken":
      connPill.classList.add("ok");
      connLabel.textContent =
        state.ws.handshake?.projectName
          ? `Connected · ${state.ws.handshake.projectName}`
          : "Connected";
      break;
    case "connecting":
      connPill.classList.add("warn");
      connLabel.textContent = "Connecting…";
      break;
    default:
      connPill.classList.add("err");
      connLabel.textContent = "Offline";
  }
}

function setConnStatus(text: string, kind: "info" | "ok" | "warn" | "err" = "info"): void {
  connStatus.textContent = text;
  connStatus.classList.remove("success", "warn", "error");
  if (kind === "ok") connStatus.classList.add("success");
  else if (kind === "warn") connStatus.classList.add("warn");
  else if (kind === "err") connStatus.classList.add("error");
}

function renderHandshake(): void {
  if (!state.ws.handshake) {
    handshakeInfo.textContent = "No handshake yet.";
    return;
  }
  const h = state.ws.handshake;
  handshakeInfo.textContent =
    `project: ${h.projectName}` +
    (h.framework ? ` · framework: ${h.framework}` : "") +
    (state.ws.lastSyncAt ? ` · last sync: ${state.ws.lastSyncAt}` : "");
}

function renderCatalogInfo(): void {
  const c = state.catalogs;
  if (!c.components.length && !c.tokens.length) {
    catalogInfo.textContent = "No catalog received from VS Code yet.";
  } else {
    catalogInfo.textContent =
      `${c.components.length} components · ${c.tokens.length} tokens cached.`;
  }
}

// ---------- WebSocket manager ---------------------------------------------

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let manuallyClosed = false;

const urlInput = $<HTMLInputElement>("ws-url");
const reconnectBtn = $<HTMLButtonElement>("reconnect-btn");
const requestCatalogBtn = $<HTMLButtonElement>("request-catalog-btn");

reconnectBtn.addEventListener("click", () => {
  manuallyClosed = false;
  reconnectAttempt = 0;
  connect();
});

requestCatalogBtn.addEventListener("click", () => {
  if (socket?.readyState === WebSocket.OPEN) {
    const id = `cat_${Date.now()}`;
    wsSend({ type: "REQUEST_CATALOG", requestId: id });
    setConnStatus(`Requested catalog (id=${id})…`);
  } else {
    setConnStatus("Not connected.", "err");
  }
});

function wsSend(out: WsOut): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(out));
}

function connect(): void {
  const url = urlInput.value.trim() || "ws://localhost:8080";
  if (!/^wss?:\/\//i.test(url)) {
    setConnStatus(`"${url}" is not a ws:// or wss:// URL.`, "err");
    return;
  }
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    socket?.close();
  } catch { /* ignore */ }

  state.ws.status = "connecting";
  setConnUi();
  setConnStatus(`Connecting to ${url}…`);

  let s: WebSocket;
  try {
    s = new WebSocket(url);
  } catch (err) {
    setConnStatus(`Failed to create socket: ${err instanceof Error ? err.message : String(err)}`, "err");
    scheduleReconnect();
    return;
  }
  socket = s;

  s.addEventListener("open", () => {
    state.ws.status = "open";
    reconnectAttempt = 0;
    setConnUi();
    setConnStatus(`Connected to ${url}. Sending handshake…`, "ok");
    wsSend({
      type: "HELLO_FROM_FIGMA",
      pluginName: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      figmaFileName: state.selection?.name ?? "",
      figmaPageName: "",
    });
  });

  s.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data) as WsIn;
      handleWsIn(msg);
    } catch (err) {
      setConnStatus(
        `Bad message from server: ${err instanceof Error ? err.message : String(err)}`,
        "warn"
      );
    }
  });

  s.addEventListener("close", () => {
    state.ws.status = "offline";
    setConnUi();
    if (!manuallyClosed) {
      setConnStatus("Disconnected. Will retry…", "warn");
      scheduleReconnect();
    } else {
      setConnStatus("Disconnected.", "warn");
    }
  });

  s.addEventListener("error", () => {
    setConnStatus(`Connection error to ${url}.`, "err");
  });
}

function scheduleReconnect(): void {
  reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
  const delay = Math.min(30_000, 500 * Math.pow(2, reconnectAttempt));
  reconnectTimer = window.setTimeout(connect, delay);
}

function handleWsIn(msg: WsIn): void {
  switch (msg.type) {
    case "HELLO_FROM_VSCODE":
      state.ws.status = "handshaken";
      state.ws.handshake = { projectName: msg.projectName, framework: msg.framework };
      state.ws.lastSyncAt = new Date().toISOString();
      setConnUi();
      renderHandshake();
      setConnStatus(
        `Handshake OK · project: ${msg.projectName}` +
          (msg.framework ? ` · framework: ${msg.framework}` : ""),
        "ok"
      );
      // Auto-pull catalogs if VS Code advertises them.
      if (msg.componentCatalogAvailable || msg.tokenCatalogAvailable) {
        wsSend({ type: "REQUEST_CATALOG", requestId: `auto_${Date.now()}` });
      }
      return;

    case "COMPONENT_CATALOG":
      state.catalogs.components = msg.items ?? [];
      send({ type: "SET_CATALOGS", components: state.catalogs.components });
      renderCatalogInfo();
      renderTreeNodePanel(activeTreeNode);
      setConnStatus(`Received ${msg.items.length} components from VS Code.`, "ok");
      return;

    case "TOKEN_CATALOG":
      state.catalogs.tokens = msg.tokens ?? [];
      send({ type: "SET_CATALOGS", tokens: state.catalogs.tokens });
      renderCatalogInfo();
      setConnStatus(`Received ${msg.tokens.length} tokens from VS Code.`, "ok");
      return;

    case "MAPPING_SUGGESTIONS":
      // Future: integrate into autofill list.
      return;

    case "SPEC_RECEIVED":
      setExportStatus(
        msg.ok
          ? `VS Code acknowledged spec (id=${msg.requestId}).`
          : `VS Code rejected spec (id=${msg.requestId}): ${msg.message ?? "unknown"}`,
        msg.ok ? "ok" : "err"
      );
      return;
  }
}

// ---------- Export tab -----------------------------------------------------

const scanBtn = $<HTMLButtonElement>("scan-btn");
const autofillBtn = $<HTMLButtonElement>("autofill-btn");
const reviewExportBtn = $<HTMLButtonElement>("review-export-btn");
const reviewBackBtn = $<HTMLButtonElement>("review-back-btn");
const doExportBtn = $<HTMLButtonElement>("do-export-btn");
const reviewDownloadBtn = $<HTMLButtonElement>("review-download-btn");
const reviewDownloadJsonBtn = $<HTMLButtonElement>("review-download-json-btn");
const exportStatus = $<HTMLDivElement>("export-status");
const reviewStatus = $<HTMLDivElement>("review-status");

const exportMain = $<HTMLDivElement>("export-main");
const exportReview = $<HTMLDivElement>("export-review");
const exportWorkspaceEl = $<HTMLDivElement>("export-workspace");
const selectionTreeEl = $<HTMLDivElement>("selection-tree");
const treeNodePanelEl = $<HTMLDivElement>("tree-node-panel");
const treeCountEl = $<HTMLSpanElement>("tree-count");
const unmatchedListEl = $<HTMLDivElement>("unmatched-list");
const unmatchedCountEl = $<HTMLSpanElement>("unmatched-count");
const reviewRowsEl = $<HTMLDivElement>("review-rows");
const exportCountEl = $<HTMLSpanElement>("export-count");

// Latest scan result, kept so Review & Export can use it without re-scanning.
let lastReviewComponents: import("./types").ReviewComponent[] = [];
let lastSelectionTree: SelectionTreeNode | null = null;
let activeTreeNode: SelectionTreeNode | null = null;

scanBtn.addEventListener("click", () => send({ type: "SCAN_SELECTION" }));
autofillBtn.addEventListener("click", () => send({ type: "AUTOFILL_MAPPINGS" }));

reviewExportBtn.addEventListener("click", () => {
  if (!lastReviewComponents.length) {
    // No scan yet — scan first; the SCAN_RESULT handler will open review.
    pendingOpenReview = true;
    send({ type: "SCAN_SELECTION" });
    setExportStatus("Scanning before review…");
    return;
  }
  openReviewView();
});

reviewBackBtn.addEventListener("click", () => closeReviewView());

doExportBtn.addEventListener("click", () => {
  // Primary export: build the spec, then send to VS Code on SPEC_READY.
  exportAction = "send";
  setReviewStatus("Building spec…");
  send({ type: "BUILD_SPEC" });
});

reviewDownloadBtn.addEventListener("click", () => {
  exportAction = "download";
  setReviewStatus("Building spec…");
  send({ type: "BUILD_SPEC" });
});

reviewDownloadJsonBtn.addEventListener("click", () => {
  exportAction = "download-json";
  setReviewStatus("Building spec...");
  send({ type: "BUILD_SPEC" });
});

let pendingOpenReview = false;
let exportAction: "send" | "download" | "download-json" | null = null;

function openReviewView(): void {
  exportMain.style.display = "none";
  exportReview.style.display = "";
  renderReviewTable();
}
function closeReviewView(): void {
  exportReview.style.display = "none";
  exportMain.style.display = "";
}

function renderReviewTable(): void {
  reviewRowsEl.innerHTML = "";
  exportCountEl.textContent = String(lastReviewComponents.length);
  if (!lastReviewComponents.length) {
    reviewRowsEl.append(el("div", { class: "empty" }, "Nothing to review."));
    return;
  }
  for (const c of lastReviewComponents) {
    reviewRowsEl.append(
      el("div", { class: "review-row" },
        el("div", { class: "rc-component" },
          el("div", { class: "nm" }, c.name),
          el("div", { class: "ty" }, c.type)
        ),
        el("div", {
          class: `rc-value${c.codeComponent ? "" : " missing"}`,
        }, c.codeComponent ?? "Not specified"),
        el("div", {
          class: `rc-value${c.codeFilePath ? "" : " missing"}`,
        }, c.codeFilePath ?? "Not specified")
      )
    );
  }
}

async function downloadSpexAsZip(
  spex: SpexBundleInfo,
  setStatus: (t: string, k?: "info" | "ok" | "warn" | "err") => void
): Promise<void> {
  try {
    setStatus("Packing SpeX bundle into ZIP…", "info");
    const zip = new JSZip();
    const root = zip.folder(spex.rootSlug);
    if (!root) throw new Error("Failed to create zip folder");

    for (const [path, file] of Object.entries(spex.files)) {
      if (file.kind === "text") {
        root.file(path, file.content);
      } else {
        root.file(path, file.base64, { base64: true });
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spex.rootSlug}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus(
      `Downloaded ${spex.rootSlug}.zip (${formatBytes(blob.size)}).\n` +
        `  components: ${spex.stats.uniqueComponents} · icons: ${spex.stats.icons} · ` +
        `fills: ${spex.stats.fills} · strokes: ${spex.stats.strokes} · ` +
        `effects: ${spex.stats.effects} · type: ${spex.stats.typography}`,
      "ok"
    );
  } catch (err) {
    setStatus(
      `Failed to build ZIP: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
  }
}

function getLastVsCodePayload(): VsCodeDesignSpecPayload | null {
  if (!state.lastSpex || !state.lastSpec) {
    return null;
  }

  return { ...state.lastSpec, spex: state.lastSpex };
}

function downloadVsCodePayloadAsJson(
  setStatus: (t: string, k?: "info" | "ok" | "warn" | "err") => void
): void {
  try {
    const payload = getLastVsCodePayload();
    if (!payload) {
      setStatus("Build the spec first.", "warn");
      return;
    }

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `${payload.spex.rootSlug}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus(
      `Downloaded ${filename} (${formatBytes(blob.size)}) with the same payload sent to VS Code.`,
      "ok"
    );
  } catch (err) {
    setStatus(
      `Failed to build JSON: ${err instanceof Error ? err.message : String(err)}`,
      "err"
    );
  }
}

function sendSpexToVsCode(
  setStatus: (t: string, k?: "info" | "ok" | "warn" | "err") => void
): void {
  const payload = getLastVsCodePayload();
  if (!payload) {
    setStatus("Build the spec first.", "warn");
    return;
  }
  if (socket?.readyState !== WebSocket.OPEN) {
    setStatus("Not connected to VS Code. Use Download ZIP or Download JSON instead.", "err");
    return;
  }
  const requestId = `spec_${Date.now()}`;
  wsSend({
    type: "SEND_DESIGN_SPEC",
    requestId,
    payload,
  });
  setStatus(
    `Sent SpeX bundle to VS Code (id=${requestId}, ` +
      `${Object.keys(payload.spex.files).length} files, ` +
      `${payload.spex.stats.uniqueComponents} components).`,
    "ok"
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function updateExportButtons(): void {
  const hasSel = !!state.selection;
  scanBtn.disabled = !hasSel;
  autofillBtn.disabled = !hasSel;
  reviewExportBtn.disabled = !hasSel;
  reviewDownloadBtn.disabled = !hasSel;
  reviewDownloadJsonBtn.disabled = !hasSel;
}

function setExportStatus(text: string, kind: "info" | "ok" | "warn" | "err" = "info"): void {
  exportStatus.textContent = text;
  exportStatus.classList.remove("success", "warn", "error");
  if (kind === "ok") exportStatus.classList.add("success");
  else if (kind === "warn") exportStatus.classList.add("warn");
  else if (kind === "err") exportStatus.classList.add("error");
}

function setReviewStatus(text: string, kind: "info" | "ok" | "warn" | "err" = "info"): void {
  reviewStatus.textContent = text;
  reviewStatus.classList.remove("success", "warn", "error");
  if (kind === "ok") reviewStatus.classList.add("success");
  else if (kind === "warn") reviewStatus.classList.add("warn");
  else if (kind === "err") reviewStatus.classList.add("error");
}

// ---------- Selection tree rendering --------------------------------------

function renderSelectionTree(tree: SelectionTreeNode | null): void {
  selectionTreeEl.innerHTML = "";
  lastSelectionTree = tree;
  if (!tree) {
    selectionTreeEl.append(el("div", { class: "empty" }, "Nothing scanned yet."));
    treeCountEl.textContent = "0";
    activeTreeNode = null;
    renderTreeNodePanel(null);
    return;
  }
  if (activeTreeNode) {
    activeTreeNode = findTreeNodeById(tree, activeTreeNode.id);
  }
  let count = 0;
  const render = (
    node: SelectionTreeNode,
    depth: number
  ): HTMLElement => {
    count++;
    const hasKids = !!node.children && node.children.length > 0;

    const dotClass =
      node.type === "TEXT" ? "tree-dot text"
      : node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION" ? "tree-dot vector"
      : node.isInstance ? `tree-dot instance${node.matched ? " matched" : ""}`
      : "tree-dot";

    const caret = el("span", {
      class: `tree-caret${hasKids ? "" : " leaf"}`,
    }, hasKids ? "▾" : "");

    const row = el("div", {
      class: `tree-row${activeTreeNode?.id === node.id ? " active" : ""}`,
      style: `padding-left:${depth * 12}px`,
      onclick: () => selectTreeNode(node),
      "data-node-id": node.id,
      title: `${node.name} — click to locate in Figma`,
    },
      caret,
      el("span", { class: dotClass }),
      el("span", { class: "tree-name" }, node.name),
      el("span", { class: "tree-type" }, node.type)
    );

    const kidsWrap = el("div", { class: "tree-children" });
    if (hasKids) {
      for (const c of node.children!) kidsWrap.append(render(c, depth + 1));
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = kidsWrap.classList.toggle("collapsed");
        caret.classList.toggle("collapsed", collapsed);
      });
    }
    return el("div", {}, row, kidsWrap);
  };

  selectionTreeEl.append(render(tree, 0));
  treeCountEl.textContent = String(count);
  renderTreeNodePanel(activeTreeNode);
}

function findTreeNodeById(
  node: SelectionTreeNode,
  nodeId: string
): SelectionTreeNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children ?? []) {
    const hit = findTreeNodeById(child, nodeId);
    if (hit) return hit;
  }
  return null;
}

function selectTreeNode(node: SelectionTreeNode): void {
  activeTreeNode = node;
  selectionTreeEl.querySelectorAll<HTMLDivElement>(".tree-row").forEach((row) => {
    row.classList.toggle("active", row.dataset.nodeId === node.id);
  });
  renderTreeNodePanel(node);
  send({ type: "ZOOM_TO_NODE", nodeId: node.id, preserveSelection: true });
}

function treeNodeMappingName(node: SelectionTreeNode): string {
  return node.mappingName || node.figmaComponentName || node.name;
}

function normaliseUiName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function findMappingForTreeNode(node: SelectionTreeNode): ComponentMapping | null {
  const byNodeId = state.mappings.find((m) => m.figmaNodeId === node.id);
  if (byNodeId) return byNodeId;
  if (node.figmaComponentKey) {
    const byKey = state.mappings.find(
      (m) => m.figmaComponentKey === node.figmaComponentKey
    );
    if (byKey) return byKey;
  }
  const mappingName = treeNodeMappingName(node);
  const exact = state.mappings.find((m) => m.figmaName === mappingName);
  if (exact) return exact;
  const normalized = normaliseUiName(mappingName);
  return state.mappings.find((m) => normaliseUiName(m.figmaName) === normalized) ?? null;
}

interface CodeComponentOption {
  key: string;
  componentName: string;
  filePath: string;
  importType: "default" | "named";
  importName?: string;
}

function codeOptionKey(
  componentName: string,
  filePath: string,
  importType: "default" | "named"
): string {
  return `${importType}::${componentName}::${filePath}`;
}

function addCodeOption(
  options: Map<string, CodeComponentOption>,
  option: Omit<CodeComponentOption, "key">
): void {
  if (!option.componentName.trim()) return;
  const key = codeOptionKey(option.componentName, option.filePath, option.importType);
  if (!options.has(key)) {
    options.set(key, { ...option, key });
  }
}

function codeOptionsForNode(node: SelectionTreeNode): CodeComponentOption[] {
  const options = new Map<string, CodeComponentOption>();
  for (const c of state.catalogs.components) {
    addCodeOption(options, {
      componentName: c.componentName,
      filePath: c.filePath,
      importType: c.exportType,
      importName: c.exportType === "named" ? c.componentName : undefined,
    });
  }
  for (const m of state.mappings) {
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

function optionFromMapping(mapping: ComponentMapping): CodeComponentOption {
  return {
    key: codeOptionKey(mapping.codeComponent, mapping.codeFilePath, mapping.importType),
    componentName: mapping.codeComponent,
    filePath: mapping.codeFilePath,
    importType: mapping.importType,
    importName: mapping.importName,
  };
}

function customPropertySummary(mapping: ComponentMapping | null): string {
  if (!mapping) return "No custom properties";
  const propCount = Object.keys(mapping.propMapping ?? {}).length;
  const defaultCount = Object.keys(mapping.defaultProps ?? {}).length;
  const total = propCount + defaultCount + (mapping.mergeChildProps ? 1 : 0);
  if (!total) return "No custom properties";
  return `${total} custom ${total === 1 ? "property" : "properties"}`;
}

function saveTreeNodeMapping(
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
    importName: option.importName ?? (option.importType === "named" ? option.componentName : undefined),
    confidence: 1,
    source: "confirmed",
    updatedAt: new Date().toISOString(),
  };
  send({ type: "SAVE_MAPPING", mapping: next });
  if (socket?.readyState === WebSocket.OPEN) {
    wsSend({ type: "SAVE_MAPPING", mapping: next });
  }
  setExportStatus(`Saved mapping for ${node.name}.`, "ok");
}

function openTreeNodeRecordModal(
  node: SelectionTreeNode,
  option?: CodeComponentOption
): void {
  const existing = findMappingForTreeNode(node);
  if (existing) {
    openRecordModal(existing);
    return;
  }
  openRecordModal({
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
  }, { mode: "create" });
}

function renderTreeNodePanel(node: SelectionTreeNode | null): void {
  treeNodePanelEl.innerHTML = "";
  exportWorkspaceEl.classList.toggle("with-node", !!node);
  treeNodePanelEl.hidden = !node;
  if (!node) {
    treeNodePanelEl.append(
      el("div", { class: "node-panel-empty" },
        "Select a node from the tree to create a component or mapping.")
    );
    return;
  }

  const mapping = findMappingForTreeNode(node);
  const options = codeOptionsForNode(node);
  const mappedOption = mapping ? optionFromMapping(mapping) : null;
  const select = el("select") as HTMLSelectElement;
  select.append(el("option", { value: "" }, "Select a code component"));
  const optionMap = new Map<string, CodeComponentOption>();
  for (const option of options) {
    optionMap.set(option.key, option);
    select.append(
      el("option", { value: option.key },
        `${option.componentName}${option.filePath ? ` - ${option.filePath}` : ""}`)
    );
  }
  if (mappedOption && !optionMap.has(mappedOption.key)) {
    optionMap.set(mappedOption.key, mappedOption);
    select.append(
      el("option", { value: mappedOption.key },
        `${mappedOption.componentName}${mappedOption.filePath ? ` - ${mappedOption.filePath}` : ""}`)
    );
  }
  select.value = mappedOption?.key ?? "";
  select.disabled = options.length === 0 && !mappedOption;

  const codeComponentValue = el("div", {
    class: `node-panel-value${mapping?.codeComponent ? "" : " missing"}`,
  }, mapping?.codeComponent ?? "Not specified");
  const codePathValue = el("div", {
    class: `node-panel-value${mapping?.codeFilePath ? "" : " missing"}`,
  }, mapping?.codeFilePath ?? "Not specified");
  const customValue = el("div", {
    class: `node-panel-value${mapping ? "" : " missing"}`,
  }, customPropertySummary(mapping));

  const saveBtn = el("button", {
    class: "btn btn-gradient full",
    disabled: !select.value,
    onclick: () => {
      const option = optionMap.get(select.value);
      if (option) saveTreeNodeMapping(node, option);
    },
  }, mapping ? "Update Mapping" : "Create Mapping");

  select.addEventListener("change", () => {
    const option = optionMap.get(select.value);
    saveBtn.disabled = !option;
    codeComponentValue.textContent = option?.componentName ?? "Not specified";
    codeComponentValue.classList.toggle("missing", !option);
    codePathValue.textContent = option?.filePath || "Not specified";
    codePathValue.classList.toggle("missing", !option?.filePath);
  });

  const createComponentDisabled =
    node.type === "COMPONENT" || node.type === "COMPONENT_SET" || node.type === "INSTANCE";
  const createComponentBtn = el("button", {
    class: "btn btn-secondary",
    disabled: createComponentDisabled,
    title: createComponentDisabled
      ? "This node type cannot be converted into a new component."
      : "Create a Figma component from this node",
    onclick: () => send({ type: "CREATE_COMPONENT_FROM_NODE", nodeId: node.id }),
  }, "Create Component");

  const recordBtn = el("button", {
    class: "btn btn-secondary",
    onclick: () => openTreeNodeRecordModal(node, optionMap.get(select.value)),
  }, mapping ? "Edit Record" : "New Record");

  treeNodePanelEl.append(
    el("div", { class: "node-summary" },
      el("div", { class: "node-summary-icon" },
        iconSvg("M3 3.5h10v9H3z", 15)
      ),
      el("div", { class: "node-summary-main" },
        el("div", { class: "node-summary-name", title: node.name }, node.name),
        el("div", { class: "node-summary-type" }, node.type)
      )
    ),
    el("div", { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Select Code Component"),
      select
    ),
    el("div", { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Code File Path"),
      codePathValue
    ),
    el("div", { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Code Component"),
      codeComponentValue
    ),
    el("div", { class: "node-panel-section" },
      el("div", { class: "node-panel-label" }, "Custom Properties"),
      customValue
    ),
    el("div", { class: "node-panel-actions" },
      createComponentBtn,
      recordBtn,
      saveBtn
    )
  );
}

function renderUnmatched(
  unmatched: Array<{ nodeId: string; name: string; figmaName: string }>
): void {
  state.lastUnmatched = unmatched;
  unmatchedListEl.innerHTML = "";
  unmatchedCountEl.textContent = String(unmatched.length);
  if (!unmatched.length) {
    unmatchedListEl.append(
      el("div", { class: "empty" }, "All instances are matched.")
    );
    return;
  }
  for (const u of unmatched) {
    unmatchedListEl.append(
      el("div", { class: "card" },
        el("div", { class: "card-title" }, u.figmaName),
        el("div", { class: "card-sub" }, `node: ${u.nodeId}`),
        el("div", { class: "row", style: "margin-top:6px" },
          el("button", {
            class: "btn btn-tiny btn-secondary auto",
            onclick: () => send({ type: "ZOOM_TO_NODE", nodeId: u.nodeId }),
          }, "Locate"),
          el("button", {
            class: "btn btn-tiny btn-secondary auto",
            onclick: () => {
              openRecordModal({
                id: `m_${Date.now()}`,
                figmaName: u.figmaName,
                codeComponent: "",
                codeFilePath: "",
                importType: "named",
                confidence: 1,
                source: "manual",
                updatedAt: new Date().toISOString(),
              });
            },
          }, "Map →")
        )
      )
    );
  }
}

// ---------- View navigation -----------------------------------------------

type ViewId = "main" | "settings" | "records";

function navigateTo(view: ViewId): void {
  document.querySelectorAll<HTMLElement>(".view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${view}`);
  });
  const cardWrap = document.getElementById("selection-card-wrap");
  if (cardWrap) cardWrap.classList.toggle("hide", view !== "main");
  if (view === "records") renderRecords();
}

$<HTMLButtonElement>("open-settings-btn").addEventListener("click", () => navigateTo("settings"));
$<HTMLButtonElement>("settings-back").addEventListener("click", () => navigateTo("main"));
$<HTMLButtonElement>("open-records-manager").addEventListener("click", () => navigateTo("records"));
$<HTMLButtonElement>("records-close").addEventListener("click", () => navigateTo("settings"));

function badge(text: string, kind: "ok" | "warn" | "err" | "muted" = "muted"): HTMLSpanElement {
  return el("span", { class: `badge ${kind}` }, text);
}

// ---------- Component Records Manager -------------------------------------

const recordsListWrap = $<HTMLDivElement>("records-list-wrap");
const recordsEmptyState = $<HTMLDivElement>("records-empty-state");
const recordsCountEl = $<HTMLSpanElement>("records-count");
const recordsExportCountEl = $<HTMLSpanElement>("records-export-count");
const recordsFooterCountEl = $<HTMLSpanElement>("records-footer-count");
const recordsSearchInput = $<HTMLInputElement>("records-search");
const recordsAddBtn = $<HTMLButtonElement>("records-add-btn");
const recordsAddFirstBtn = $<HTMLButtonElement>("records-add-first-btn");
const recordsExportBtn = $<HTMLButtonElement>("records-export-btn");
const recordsProjectName = $<HTMLDivElement>("records-project-name");

let recordsSearch = "";
recordsSearchInput.addEventListener("input", () => {
  recordsSearch = recordsSearchInput.value.trim().toLowerCase();
  renderRecords();
});

recordsAddBtn.addEventListener("click", () => openRecordModal());
recordsAddFirstBtn.addEventListener("click", () => openRecordModal());
recordsExportBtn.addEventListener("click", () => exportRecordsAsJson());

function renderRecords(): void {
  recordsProjectName.textContent = state.ws.handshake?.projectName ?? "Local";

  const filtered = filterRecords(state.mappings, recordsSearch);

  recordsCountEl.textContent = String(state.mappings.length);
  recordsExportCountEl.textContent = String(state.mappings.length);
  recordsFooterCountEl.textContent =
    recordsSearch
      ? `${filtered.length} of ${state.mappings.length} records`
      : `${state.mappings.length} record${state.mappings.length === 1 ? "" : "s"} total`;

  // Empty state when there are no records at all (not just filtered out).
  const showEmpty = state.mappings.length === 0;
  recordsEmptyState.hidden = !showEmpty;
  recordsListWrap.style.display = showEmpty ? "none" : "flex";

  recordsListWrap.innerHTML = "";

  if (!showEmpty && filtered.length === 0) {
    recordsListWrap.append(
      el("div", { class: "empty" }, `No records match "${recordsSearch}".`)
    );
    return;
  }

  for (const m of filtered) {
    recordsListWrap.append(renderRecordCard(m));
  }
}

function filterRecords(list: ComponentMapping[], q: string): ComponentMapping[] {
  if (!q) return list.slice().sort((a, b) => a.codeComponent.localeCompare(b.codeComponent));
  const matches = list.filter((m) =>
    m.codeComponent.toLowerCase().includes(q) ||
    m.figmaName.toLowerCase().includes(q) ||
    (m.codeFilePath ?? "").toLowerCase().includes(q)
  );
  matches.sort((a, b) => a.codeComponent.localeCompare(b.codeComponent));
  return matches;
}

function renderRecordCard(m: ComponentMapping): HTMLDivElement {
  const initials = (m.codeComponent || m.figmaName || "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "?";

  return el("div", { class: "record-card" },
    el("div", { class: "record-card-avatar" }, initials),
    el("div", { class: "record-card-body" },
      el("div", { class: "record-card-name" }, m.codeComponent || "(no code component)"),
      el("div", { class: "record-card-figma" }, m.figmaName || "(no figma name)"),
      el("div", { class: "record-card-path", title: m.codeFilePath },
        m.codeFilePath || "(no file path)")
    ),
    el("div", { class: "record-card-actions" },
      ...(m.previewUiUrl
        ? [el("a", {
            class: "record-action",
            href: m.previewUiUrl,
            target: "_blank",
            rel: "noopener noreferrer",
            title: "Open preview UI",
          },
            iconSvg("M5 11l6-6M11 5h-4M11 5v4", 13)
          )]
        : []
      ),
      el("button", {
        class: "record-action",
        title: "Edit record",
        onclick: () => openRecordModal(m),
      }, iconSvg("M2.5 13.5l3-.5L13.5 5l-2.5-2.5L3 10.5l-.5 3z", 13)),
      el("button", {
        class: "record-action danger",
        title: "Delete record",
        onclick: () => {
          // eslint-disable-next-line no-alert
          if (confirm(`Delete "${m.codeComponent || m.figmaName}"?`)) {
            send({ type: "DELETE_MAPPING", id: m.id });
          }
        },
      }, iconSvg("M3 5h10M5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M4.5 5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1L11.5 5", 13))
    )
  ) as HTMLDivElement;
}

function iconSvg(d: string, size = 13): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function exportRecordsAsJson(): void {
  const blob = new Blob(
    [JSON.stringify({ version: 1, mappings: state.mappings }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "component-records.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Add / Edit Record modal ---------------------------------------

const recordModal = $<HTMLDivElement>("record-modal");
const modalTitleEl = $<HTMLDivElement>("modal-title");
const modalSubEl = $<HTMLDivElement>("modal-sub");
const modalHeaderIcon = $<HTMLDivElement>("modal-header-icon");
const modalCreateLabel = $<HTMLSpanElement>("modal-create-label");

const recCodeComponent = $<HTMLInputElement>("rec-code-component");
const recFigmaName = $<HTMLInputElement>("rec-figma-name");
const recCodePath = $<HTMLInputElement>("rec-code-path");
const recPreviewUrl = $<HTMLInputElement>("rec-preview-url");
const recFigmaKey = $<HTMLInputElement>("rec-figma-key");
const recImportType = $<HTMLSelectElement>("rec-import-type");
const recImportName = $<HTMLInputElement>("rec-import-name");
const recPropMapping = $<HTMLTextAreaElement>("rec-prop-mapping");
const recDefaultProps = $<HTMLTextAreaElement>("rec-default-props");
const recMergeChildren = $<HTMLInputElement>("rec-merge-children");
const recConfidence = $<HTMLInputElement>("rec-confidence");
const ffCodeComponent = $<HTMLDivElement>("ff-code-component");
const figmaNameDropdown = $<HTMLDivElement>("figma-name-dropdown");
const recFigmaNameHelp = $<HTMLDivElement>("rec-figma-name-help");

let editingRecord: ComponentMapping | null = null;
let recordDraft: Partial<ComponentMapping> | null = null;
// Cache of component names in the Figma file (powers the Figma Name dropdown).
let figmaComponentNames: string[] = [];
// Index of the keyboard-highlighted option in the open dropdown (-1 = none).
let comboActiveIndex = -1;

function renderFigmaNameOptions(): void {
  recFigmaNameHelp.textContent = figmaComponentNames.length
    ? `Type to search ${figmaComponentNames.length} components in this Figma file.`
    : "The name of the component as it appears in Figma";
}

function filterFigmaNames(query: string): string[] {
  const q = query.trim().toLowerCase();
  const list = q
    ? figmaComponentNames.filter((n) => n.toLowerCase().includes(q))
    : figmaComponentNames;
  return list.slice(0, 200);
}

function showFigmaNameDropdown(): void {
  const matches = filterFigmaNames(recFigmaName.value);
  comboActiveIndex = -1;
  figmaNameDropdown.innerHTML = "";

  if (!figmaComponentNames.length) {
    figmaNameDropdown.append(
      el("div", { class: "combo-empty" }, "No components found in this file.")
    );
    figmaNameDropdown.hidden = false;
    return;
  }
  if (!matches.length) {
    figmaNameDropdown.append(
      el("div", { class: "combo-empty" },
        `No component matches "${recFigmaName.value.trim()}".`)
    );
    figmaNameDropdown.hidden = false;
    return;
  }

  for (const name of matches) {
    const opt = el("div", { class: "combo-option", title: name }, name);
    // mousedown (not click) fires before the input's blur — preventDefault
    // keeps focus so the value assignment isn't lost.
    opt.addEventListener("mousedown", (e) => {
      e.preventDefault();
      recFigmaName.value = name;
      hideFigmaNameDropdown();
    });
    figmaNameDropdown.append(opt);
  }
  figmaNameDropdown.hidden = false;
}

function hideFigmaNameDropdown(): void {
  figmaNameDropdown.hidden = true;
  comboActiveIndex = -1;
}

function moveComboActive(delta: number): void {
  const opts = Array.from(
    figmaNameDropdown.querySelectorAll<HTMLDivElement>(".combo-option")
  );
  if (!opts.length) return;
  opts.forEach((o) => o.classList.remove("active"));
  comboActiveIndex = (comboActiveIndex + delta + opts.length) % opts.length;
  const active = opts[comboActiveIndex];
  active.classList.add("active");
  active.scrollIntoView({ block: "nearest" });
}

recFigmaName.addEventListener("focus", showFigmaNameDropdown);
recFigmaName.addEventListener("input", showFigmaNameDropdown);
recFigmaName.addEventListener("blur", () => {
  // Delay so a mousedown on an option still registers.
  window.setTimeout(hideFigmaNameDropdown, 120);
});
recFigmaName.addEventListener("keydown", (e) => {
  if (figmaNameDropdown.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); moveComboActive(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveComboActive(-1); }
  else if (e.key === "Enter") {
    const opts = figmaNameDropdown.querySelectorAll<HTMLDivElement>(".combo-option");
    if (comboActiveIndex >= 0 && opts[comboActiveIndex]) {
      e.preventDefault();
      recFigmaName.value = opts[comboActiveIndex].textContent ?? "";
      hideFigmaNameDropdown();
    }
  } else if (e.key === "Escape") {
    hideFigmaNameDropdown();
  }
});

$<HTMLButtonElement>("modal-close").addEventListener("click", closeRecordModal);
$<HTMLButtonElement>("modal-cancel").addEventListener("click", closeRecordModal);
$<HTMLButtonElement>("modal-create").addEventListener("click", saveRecordFromModal);
recordModal.addEventListener("click", (e) => {
  if (e.target === recordModal) closeRecordModal();
});
recCodeComponent.addEventListener("input", () => {
  if (recCodeComponent.value.trim()) ffCodeComponent.classList.remove("error");
});

function openRecordModal(
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
    modalHeaderIcon.appendChild(iconSvg("M2.5 13.5l3-.5L13.5 5l-2.5-2.5L3 10.5l-.5 3z", 18));
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
}

function closeRecordModal(): void {
  recordModal.hidden = true;
  editingRecord = null;
  recordDraft = null;
}

function saveRecordFromModal(): void {
  const codeComponent = recCodeComponent.value.trim();
  if (!codeComponent) {
    ffCodeComponent.classList.add("error");
    recCodeComponent.focus();
    return;
  }

  let propMapping: Record<string, string> | undefined;
  let defaultProps: Record<string, unknown> | undefined;
  try { propMapping = recPropMapping.value.trim() ? JSON.parse(recPropMapping.value) : undefined; }
  catch { alert("Prop Mapping is not valid JSON."); return; }
  try { defaultProps = recDefaultProps.value.trim() ? JSON.parse(recDefaultProps.value) : undefined; }
  catch { alert("Default Props is not valid JSON."); return; }

  const base: Partial<ComponentMapping> & Pick<ComponentMapping, "id" | "source" | "updatedAt"> =
    editingRecord ?? {
      ...(recordDraft ?? {}),
      id: recordDraft?.id ?? `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
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
    figmaComponentKey: recFigmaKey.value.trim() || base.figmaComponentKey || undefined,
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
  if (socket?.readyState === WebSocket.OPEN) {
    wsSend({ type: "SAVE_MAPPING", mapping: next });
  }
  closeRecordModal();
}

// ---------- Tokens tab -----------------------------------------------------

const tokenList = $<HTMLDivElement>("token-list");
const tokenCountEl = $<HTMLSpanElement>("token-count");

function renderTokens(tokens: DesignTokenRef[]): void {
  tokenList.innerHTML = "";
  tokenCountEl.textContent = String(tokens.length);
  if (!tokens.length) {
    tokenList.append(
      el("div", { class: "empty" },
        "No tokens found. Select a frame — tokens are extracted on scan.")
    );
    return;
  }
  // Mapped tokens first, then by usage count.
  const sorted = tokens.slice().sort((a, b) => {
    if (!!a.codeTokenName !== !!b.codeTokenName) return a.codeTokenName ? -1 : 1;
    return b.usageCount - a.usageCount;
  });
  for (const t of sorted.slice(0, 200)) {
    const b = t.codeTokenName
      ? badge(`→ ${t.codeTokenName}`, "ok")
      : badge("no code mapping", "warn");
    tokenList.append(
      el("div", { class: "card" },
        el("div", { class: "card-title" }, t.figmaTokenName, " ", b),
        el("div", { class: "card-sub" }, `type: ${t.type} · usage: ${t.usageCount}` +
          (t.codeTokenPath ? ` · file: ${t.codeTokenPath}` : ""))
      )
    );
  }
  if (sorted.length > 200) {
    tokenList.append(el("div", { class: "card-sub" }, `… and ${sorted.length - 200} more`));
  }
}

// ---------- Assets tab -----------------------------------------------------

const assetList = $<HTMLDivElement>("asset-list");

document.querySelectorAll<HTMLButtonElement>("#panel-assets [data-mark]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!state.selection) return;
    const m = btn.dataset.mark;
    const mark: AssetMark = m === "clear" ? null : (m as AssetMark);
    send({ type: "SET_NODE_MARK", nodeId: state.selection.id, mark });
    setAssetInfo(
      mark ? `Marked "${state.selection.name}" as ${mark}.` : `Cleared mark on "${state.selection.name}".`
    );
  });
});

function setAssetInfo(text: string): void {
  ($("asset-info") as HTMLDivElement).textContent = text;
}

function renderAssets(spec: CompressedSpec): void {
  assetList.innerHTML = "";
  if (!spec.assets.length) {
    assetList.append(el("div", { class: "empty" }, "No assets exported. Mark a node as Icon/Image/Vector and rebuild."));
    return;
  }
  for (const a of spec.assets) {
    assetList.append(
      el("div", { class: "card" },
        el("div", { class: "card-title" }, a.name, " ", badge(a.type, "ok")),
        el("div", { class: "card-sub" }, `path: ${a.path} · format: ${a.format} · node: ${a.figmaNodeId}`),
        el("div", { class: "row", style: "margin-top:6px" },
          el("button", {
            class: "btn btn-tiny btn-secondary auto",
            onclick: () => send({ type: "ZOOM_TO_NODE", nodeId: a.figmaNodeId }),
          }, "Locate")
        )
      )
    );
  }
}

// ---------- Report tab -----------------------------------------------------

function renderReport(spec: CompressedSpec): void {
  const r = spec.mappingReport;
  $("rs-matched").textContent = String(r.matched);
  $("rs-unmatched").textContent = String(r.unmatched);
  $("rs-confidence").textContent = `${(r.confidence * 100).toFixed(0)}%`;
  $("rs-token").textContent = `${(r.tokenCoverage * 100).toFixed(0)}%`;
  $("rs-assets").textContent = String(spec.assets.length);
  $("rs-tokens").textContent = String(spec.tokens.length);

  const unmatchedList = $<HTMLDivElement>("rs-unmatched-list");
  unmatchedList.innerHTML = "";
  if (!r.unmatchedDetails.length) {
    unmatchedList.append(el("div", { class: "empty" }, "🎉 All instances are matched."));
  } else {
    for (const u of r.unmatchedDetails) {
      unmatchedList.append(
        el("div", { class: "card" },
          el("div", { class: "card-title" }, u.figmaName, " ", badge(u.figmaType, "muted")),
          el("div", { class: "card-sub" }, `node: ${u.nodeId}`),
          el("div", { class: "row", style: "margin-top:6px" },
            el("button", {
              class: "btn btn-tiny btn-secondary auto",
              onclick: () => send({ type: "ZOOM_TO_NODE", nodeId: u.nodeId }),
            }, "Locate"),
            el("button", {
              class: "btn btn-tiny btn-secondary auto",
              onclick: () => {
                openRecordModal({
                  id: `m_${Date.now()}`,
                  figmaName: u.figmaName,
                  codeComponent: "",
                  codeFilePath: "",
                  importType: "named",
                  confidence: 1,
                  source: "manual",
                  updatedAt: new Date().toISOString(),
                });
              },
            }, "Map →")
          )
        )
      );
    }
  }

  const missingTokens = $<HTMLDivElement>("rs-missing-tokens");
  missingTokens.innerHTML = "";
  if (!r.missingTokens.length) {
    missingTokens.append(el("div", { class: "empty" }, "All used tokens have a code mapping."));
  } else {
    for (const t of r.missingTokens) {
      missingTokens.append(
        el("div", { class: "card" },
          el("div", { class: "card-title" }, t.figmaTokenName, " ", badge(t.type, "warn"))
        )
      );
    }
  }
}

// ---------- Autofill ------------------------------------------------------

function handleAutofill(suggestions: AutofillSuggestion[]): void {
  if (!suggestions.length) {
    setExportStatus("Auto-Fill found no INSTANCE nodes in selection.", "warn");
    return;
  }
  let applied = 0;
  for (const s of suggestions) {
    const top = s.candidates[0];
    if (!top || top.confidence < 0.85) continue;
    if (state.mappings.some((m) =>
      m.figmaName === s.figmaName ||
      (m.figmaComponentKey && m.figmaComponentKey === s.figmaComponentKey)
    )) continue;
    const next: ComponentMapping = {
      id: `auto_${Date.now()}_${applied}`,
      figmaName: s.figmaName,
      figmaComponentKey: s.figmaComponentKey,
      codeComponent: top.codeComponent,
      codeFilePath: top.codeFilePath,
      importType: "named",
      importName: top.codeComponent,
      confidence: top.confidence,
      source: "auto-suggested",
      updatedAt: new Date().toISOString(),
    };
    send({ type: "SAVE_MAPPING", mapping: next });
    applied++;
  }
  const lines: string[] = [
    `Auto-Fill scanned ${suggestions.length} unique instances.`,
    `Auto-applied ${applied} high-confidence mappings (≥85%).`,
  ];
  for (const s of suggestions.slice(0, 10)) {
    const top = s.candidates[0];
    if (!top) {
      lines.push(`  • ${s.figmaName} → (no candidate)`);
    } else {
      lines.push(`  • ${s.figmaName} → ${top.codeComponent} (${Math.round(top.confidence * 100)}% · ${top.reason})`);
    }
  }
  if (suggestions.length > 10) lines.push(`  … and ${suggestions.length - 10} more`);
  setExportStatus(lines.join("\n"), applied ? "ok" : "warn");
}

// ---------- Main runtime messages -----------------------------------------

window.addEventListener("message", (event: MessageEvent) => {
  const msg = (event.data && event.data.pluginMessage) as MainToUi | undefined;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "INITIAL_STATE":
      state.mappings = msg.mappings;
      state.catalogs = msg.catalogs;
      renderSelection(msg.hasValidSelection ? msg.selection : null);
      renderRecords();
      renderCatalogInfo();
      // Open WebSocket on startup.
      connect();
      return;

    case "SELECTION_STATE":
      renderSelection(msg.hasValidSelection ? msg.selection : null);
      return;

    case "MAPPINGS_UPDATED":
      state.mappings = msg.mappings;
      renderRecords();
      renderTreeNodePanel(activeTreeNode);
      return;

    case "SCAN_RESULT":
      renderSelectionTree(msg.summary.tree);
      renderUnmatched(msg.summary.unmatchedInstances);
      renderTokens(msg.summary.tokens);
      lastReviewComponents = msg.summary.reviewComponents;
      reviewExportBtn.disabled = false;
      setExportStatus(
        `Scanned ${msg.summary.nodes} nodes · ${msg.summary.instances} instances · ` +
          `${msg.summary.unmatchedInstances.length} unmatched · ` +
          `${msg.summary.tokens.length} tokens.`,
        msg.summary.unmatchedInstances.length === 0 ? "ok" : "warn"
      );
      if (pendingOpenReview) {
        pendingOpenReview = false;
        openReviewView();
      }
      return;

    case "AUTOFILL_RESULT":
      handleAutofill(msg.suggestions);
      return;

    case "SPEC_READY": {
      state.lastSpec = msg.spec;
      state.lastSpex = msg.spex;
      updateExportButtons();
      renderTokens(msg.spec.tokens);
      renderAssets(msg.spec);
      renderReport(msg.spec);
      // Dispatch the pending export action triggered from the review page.
      const action = exportAction;
      exportAction = null;
      if (action === "send") {
        sendSpexToVsCode(setReviewStatus);
      } else if (action === "download") {
        void downloadSpexAsZip(msg.spex, setReviewStatus);
      } else if (action === "download-json") {
        downloadVsCodePayloadAsJson(setReviewStatus);
      } else {
        setExportStatus(
          `Spec built: ${msg.spex.stats.uniqueComponents} components, ` +
            `${msg.spex.stats.icons} icons, ${msg.spec.tokens.length} tokens.`,
          "ok"
        );
      }
      return;
    }

    case "FIGMA_COMPONENTS":
      figmaComponentNames = msg.names;
      renderFigmaNameOptions();
      return;

    case "PROGRESS":
      if (exportReview.style.display !== "none") setReviewStatus(msg.stage, "info");
      else setExportStatus(msg.stage, "info");
      return;

    case "ERROR":
      if (exportReview.style.display !== "none") setReviewStatus(`Error: ${msg.error}`, "err");
      else setExportStatus(`Error: ${msg.error}`, "err");
      return;
  }
});

// ---------- Boot ----------------------------------------------------------

setConnUi();
renderHandshake();
renderCatalogInfo();
renderRecords();
send({ type: "INIT" });
send({ type: "GET_FIGMA_COMPONENTS" });
