import * as vscode from 'vscode';
import WebSocket, { type RawData, WebSocketServer } from 'ws';
import { ensureFigmaStorage, saveLatestFigmaContext } from '../shared/figmaStore';
import { ConfigService } from '../services/ConfigService';
import { FigmaMappingService, StoredComponentMapping } from '../services/FigmaMappingService';
import {
  ComponentFramework,
  ComponentScannerService,
  ScannedComponent
} from '../services/ComponentScannerService';
import {
  FIGMA_BRIDGE_HOST,
  FIGMA_BRIDGE_PORT,
  FIGMA_BRIDGE_URL,
  FigmaBridgeLogger,
  FigmaBridgeStatus,
  FigmaWebSocketBridge,
  NormalizedFigmaMessage
} from './types';

export async function startFigmaWebSocketBridge(
  context: vscode.ExtensionContext,
  outputChannel: FigmaBridgeLogger
): Promise<FigmaWebSocketBridge> {
  await ensureFigmaStorage(context);

  const clients = new Set<WebSocket>();
  let lastPingAt: string | undefined;
  let lastPayloadAt: string | undefined;

  const server = new WebSocketServer({
    host: FIGMA_BRIDGE_HOST,
    port: FIGMA_BRIDGE_PORT
  });

  const getStatus = (): FigmaBridgeStatus => ({
    running: true,
    connected: clients.size > 0,
    port: FIGMA_BRIDGE_PORT,
    url: FIGMA_BRIDGE_URL,
    ...(lastPingAt ? { lastPingAt } : {}),
    ...(lastPayloadAt ? { lastPayloadAt } : {})
  });

  const controller: FigmaWebSocketBridge = {
    getStatus,
    stop: async () => {
      for (const client of clients) {
        client.close();
      }

      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };

  server.on('connection', (socket, request) => {
    clients.add(socket);
    outputChannel.appendLine(`[${new Date().toISOString()}] Figma plugin connected from ${request.socket.remoteAddress ?? 'unknown'}`);

    socket.on('message', message => {
      void handleMessage(context, socket, message, outputChannel, timestamp => {
        lastPingAt = timestamp;
      }, timestamp => {
        lastPayloadAt = timestamp;
      }).catch(error => {
        const messageText = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`[${new Date().toISOString()}] Failed to process Figma bridge message: ${messageText}`);
      });
    });

    socket.on('close', (code, reasonBuffer) => {
      clients.delete(socket);
      const reason = reasonBuffer?.toString('utf8') || '(no reason)';
      outputChannel.appendLine(
        `[${new Date().toISOString()}] Figma plugin disconnected (code=${code}, reason=${reason})`
      );
    });

    socket.on('error', error => {
      outputChannel.appendLine(`[${new Date().toISOString()}] Figma plugin socket error: ${error.message}`);
    });
  });

  return await new Promise<FigmaWebSocketBridge>((resolve, reject) => {
    let started = false;

    server.once('listening', () => {
      started = true;
      outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge running at ${FIGMA_BRIDGE_URL}`);
      resolve(controller);
    });

    server.on('error', error => {
      outputChannel.appendLine(`[${new Date().toISOString()}] Figma MCP bridge error: ${error.message}`);
      if (!started) {
        reject(error);
      }
    });
  });
}

async function handleMessage(
  context: vscode.ExtensionContext,
  socket: WebSocket,
  message: RawData,
  outputChannel: FigmaBridgeLogger,
  markPing: (timestamp: string) => void,
  markPayload: (timestamp: string) => void
): Promise<void> {
  const parsed = parseJsonMessage(message);

  if (!parsed.ok) {
    outputChannel.appendLine(`[${new Date().toISOString()}] Ignored non-JSON Figma bridge message`);
    return;
  }

  const normalized = normalizeFigmaMessage(parsed.value);
  const receivedAt = new Date().toISOString();

  if (normalized.kind === 'ping') {
    markPing(receivedAt);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'pong', receivedAt }));
    }
    return;
  }

  if (normalized.kind === 'hello') {
    const info = normalized.info ?? {};
    const summary = [
      info.pluginName ? `plugin=${info.pluginName}` : undefined,
      info.version ? `version=${info.version}` : undefined,
      info.figmaFileName ? `file=${info.figmaFileName}` : undefined,
      info.figmaPageName ? `page=${info.figmaPageName}` : undefined
    ]
      .filter(Boolean)
      .join(', ');

    outputChannel.appendLine(`[${receivedAt}] Figma plugin handshake received${summary ? ` (${summary})` : ''}`);

    if (socket.readyState === WebSocket.OPEN) {
      const helloPayload = await buildHelloFromVsCode();
      socket.send(JSON.stringify({
        ...helloPayload,
        receivedAt
      }));
      outputChannel.appendLine(
        `[${receivedAt}] Sent HELLO_FROM_VSCODE (project=${helloPayload.projectName}, ` +
        `framework=${helloPayload.framework ?? 'unknown'}, ` +
        `projectMappings=${helloPayload.projectMappings.length})`
      );
    }
    return;
  }

  if (normalized.kind === 'save-mapping') {
    const mappingService = new FigmaMappingService();
    await mappingService.upsert(normalized.mapping);
    markPayload(receivedAt);
    outputChannel.appendLine(
      `[${receivedAt}] Saved mapping to .project/figma-bridge: ` +
      `${normalized.mapping.figmaName} → ${normalized.mapping.codeComponent} ` +
      `(source=${normalized.mapping.source})`
    );

    if (socket.readyState === WebSocket.OPEN) {
      const all = await mappingService.loadAll();
      socket.send(JSON.stringify({
        type: 'PROJECT_MAPPINGS',
        mappings: all,
        receivedAt
      }));
    }
    return;
  }

  if (normalized.kind === 'delete-mapping') {
    const mappingService = new FigmaMappingService();
    await mappingService.delete(normalized.mappingId);
    outputChannel.appendLine(`[${receivedAt}] Deleted mapping ${normalized.mappingId} from .project/figma-bridge`);

    if (socket.readyState === WebSocket.OPEN) {
      const all = await mappingService.loadAll();
      socket.send(JSON.stringify({
        type: 'PROJECT_MAPPINGS',
        mappings: all,
        receivedAt
      }));
    }
    return;
  }

  if (normalized.kind === 'request-catalog') {
    const items = await buildComponentCatalog();
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'COMPONENT_CATALOG',
        ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
        items,
        receivedAt
      }));
    }
    outputChannel.appendLine(`[${receivedAt}] Sent COMPONENT_CATALOG with ${items.length} components from source scan`);
    return;
  }

  if (normalized.kind === 'request-project-mappings') {
    const mappingService = new FigmaMappingService();
    const all = await mappingService.loadAll();
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'PROJECT_MAPPINGS',
        ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
        mappings: all,
        receivedAt
      }));
    }
    outputChannel.appendLine(`[${receivedAt}] Sent PROJECT_MAPPINGS (${all.length} entries)`);
    return;
  }

  if (normalized.kind === 'figma-context') {
    await saveLatestFigmaContext(context, normalized.payload);
    const mappingService = new FigmaMappingService();
    const syncedMappings = await mappingService.upsertMany(readMappingsFromPayload(normalized.payload));
    markPayload(receivedAt);
    outputChannel.appendLine(
      `[${receivedAt}] Saved latest Figma context from WebSocket message; ` +
      (
        syncedMappings > 0
          ? `synced ${syncedMappings} component mapping${syncedMappings === 1 ? '' : 's'} to .project/figma-bridge`
          : 'ensured .project/figma-bridge/component-mappings.json'
      )
    );

    if (socket.readyState === WebSocket.OPEN) {
      const requestId = normalized.requestId ?? (isRecord(parsed.value) ? readString(parsed.value.requestId) : undefined);
      socket.send(JSON.stringify({
        type: 'SPEC_RECEIVED',
        ok: true,
        ...(requestId ? { requestId } : {}),
        receivedAt
      }));
    }
    return;
  }

  outputChannel.appendLine(`[${receivedAt}] Unknown Figma bridge message ignored: ${describeMessage(parsed.value)}`);
}

async function buildHelloFromVsCode(): Promise<{
  type: 'HELLO_FROM_VSCODE';
  projectName: string;
  framework?: ComponentFramework;
  componentCatalogAvailable: boolean;
  tokenCatalogAvailable: boolean;
  projectMappings: StoredComponentMapping[];
  projectMappingsCount: number;
}> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const projectName = workspaceFolder?.name ?? 'Unknown Workspace';

  const mappingService = new FigmaMappingService();
  const projectMappings = await mappingService.loadAll();

  let framework: ComponentFramework | undefined;
  if (workspaceFolder) {
    try {
      const scanner = new ComponentScannerService();
      framework = await scanner.detectFramework(workspaceFolder.uri.fsPath);
    } catch {
      framework = undefined;
    }
  }

  return {
    type: 'HELLO_FROM_VSCODE',
    projectName,
    framework,
    componentCatalogAvailable: true,
    tokenCatalogAvailable: false,
    projectMappings,
    projectMappingsCount: projectMappings.length
  };
}

async function buildComponentCatalog(): Promise<Array<{
  componentName: string;
  filePath: string;
  exportType: 'default' | 'named';
  framework?: string;
  aliases?: string[];
}>> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return [];
  }

  const configService = new ConfigService();
  const scanner = new ComponentScannerService();
  const paths = configService.getComponentPaths();
  const components: ScannedComponent[] = await scanner.scan(workspaceRoot, paths);

  return components.map(c => ({
    componentName: c.name,
    filePath: c.filePath,
    exportType: c.exportType,
    framework: c.framework,
    aliases: generateAliases(c.name)
  }));
}

function generateAliases(name: string): string[] {
  const aliases = new Set<string>();
  aliases.add(`Base${name}`);
  aliases.add(`App${name}`);
  aliases.add(`Common${name}`);
  if (name.startsWith('App')) {
    aliases.add(name.slice(3));
  }
  if (name.startsWith('Base')) {
    aliases.add(name.slice(4));
  }
  return Array.from(aliases).filter(a => a.length > 0 && a !== name);
}

export function normalizeFigmaMessage(raw: unknown): NormalizedFigmaMessage {
  if (Array.isArray(raw)) {
    return { kind: 'figma-context', payload: raw };
  }

  if (!isRecord(raw)) {
    return { kind: 'unknown' };
  }

  const messageName = readMessageName(raw);

  if (messageName && isPingMessage(messageName)) {
    return { kind: 'ping' };
  }

  if (messageName && isHelloMessage(messageName)) {
    return {
      kind: 'hello',
      info: {
        pluginName: readString(raw.pluginName),
        version: readString(raw.version),
        figmaFileName: readString(raw.figmaFileName) ?? readString(raw.fileName),
        figmaPageName: readString(raw.figmaPageName) ?? readString(raw.pageName)
      }
    };
  }

  if (messageName === 'save_mapping' || messageName === 'savemapping') {
    const mapping = readMapping(raw.mapping);
    if (mapping) {
      return { kind: 'save-mapping', mapping };
    }
  }

  if (messageName === 'delete_mapping' || messageName === 'deletemapping') {
    const mappingId = readString(raw.id) ?? readString((raw as Record<string, unknown>).mappingId);
    if (mappingId) {
      return { kind: 'delete-mapping', mappingId };
    }
  }

  if (messageName === 'request_catalog' || messageName === 'requestcatalog') {
    return {
      kind: 'request-catalog',
      ...(readString(raw.requestId) ? { requestId: readString(raw.requestId)! } : {})
    };
  }

  if (
    messageName === 'request_project_mappings' ||
    messageName === 'requestprojectmappings' ||
    messageName === 'get_project_mappings'
  ) {
    return {
      kind: 'request-project-mappings',
      ...(readString(raw.requestId) ? { requestId: readString(raw.requestId)! } : {})
    };
  }

  if (messageName === 'send_design_spec' || messageName === 'senddesignspec') {
    const payload = (raw as Record<string, unknown>).payload;
    return {
      kind: 'figma-context',
      payload: payload ?? raw,
      ...(readString(raw.requestId) ? { requestId: readString(raw.requestId)! } : {})
    };
  }

  const payloadKeys = ['payload', 'data', 'bundle', 'spec', 'context', 'selection', 'nodes'];

  if (isSelectionMessage(messageName)) {
    for (const key of payloadKeys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        return { kind: 'figma-context', payload: raw[key] };
      }
    }
  }

  if (hasFigmaNodeData(raw)) {
    return { kind: 'figma-context', payload: raw };
  }

  for (const key of payloadKeys) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && hasFigmaNodeData(raw[key])) {
      return { kind: 'figma-context', payload: raw[key] };
    }
  }

  for (const key of payloadKeys) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      return { kind: 'figma-context', payload: raw[key] };
    }
  }

  return { kind: 'unknown' };
}

function readMapping(value: unknown): StoredComponentMapping | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = readString(value.id);
  const figmaName = readString(value.figmaName);
  const codeComponent = readString(value.codeComponent);
  const codeFilePath = typeof value.codeFilePath === 'string' ? value.codeFilePath : '';
  const importTypeRaw = readString(value.importType);
  const importType = importTypeRaw === 'default' ? 'default' : 'named';
  const sourceRaw = readString(value.source);
  const source: StoredComponentMapping['source'] =
    sourceRaw === 'manual' || sourceRaw === 'confirmed' ? sourceRaw : 'auto-suggested';

  if (!id || !figmaName || !codeComponent) {
    return undefined;
  }

  const mapping: StoredComponentMapping = {
    id,
    figmaName,
    codeComponent,
    codeFilePath,
    importType,
    source,
    confidence: typeof value.confidence === 'number' ? value.confidence : 1,
    updatedAt: readString(value.updatedAt) ?? new Date().toISOString()
  };

  const figmaNodeId = readString(value.figmaNodeId);
  if (figmaNodeId) {
    mapping.figmaNodeId = figmaNodeId;
  }

  const figmaComponentKey = readString(value.figmaComponentKey);
  if (figmaComponentKey) {
    mapping.figmaComponentKey = figmaComponentKey;
  }

  const importName = readString(value.importName);
  if (importName) {
    mapping.importName = importName;
  }

  if (isRecord(value.propMapping)) {
    mapping.propMapping = Object.fromEntries(
      Object.entries(value.propMapping).filter(([, v]) => typeof v === 'string')
    ) as Record<string, string>;
  }

  if (isRecord(value.defaultProps)) {
    mapping.defaultProps = value.defaultProps as Record<string, unknown>;
  }

  if (typeof value.mergeChildProps === 'boolean') {
    mapping.mergeChildProps = value.mergeChildProps;
  }

  const previewUiUrl = readString(value.previewUiUrl);
  if (previewUiUrl) {
    mapping.previewUiUrl = previewUiUrl;
  }

  const description = readString(value.description);
  if (description) {
    mapping.description = description;
  }

  return mapping;
}

function readMappingsFromPayload(payload: unknown): StoredComponentMapping[] {
  if (!isRecord(payload)) {
    return [];
  }

  const mappingSources = [
    payload.componentMappings,
    payload.mappings,
    payload.projectMappings
  ];
  const mappings: StoredComponentMapping[] = [];
  const seen = new Set<string>();

  for (const source of mappingSources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const value of source) {
      const mapping = readMapping(value);
      if (!mapping || seen.has(mapping.id)) {
        continue;
      }

      seen.add(mapping.id);
      mappings.push(mapping);
    }
  }

  return mappings;
}

function parseJsonMessage(message: RawData): { ok: true; value: unknown } | { ok: false } {
  try {
    const text = Array.isArray(message)
      ? Buffer.concat(message).toString('utf8')
      : Buffer.isBuffer(message)
        ? message.toString('utf8')
        : message instanceof ArrayBuffer
          ? Buffer.from(message).toString('utf8')
          : Buffer.from(message).toString('utf8');

    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function readMessageName(message: Record<string, unknown>): string | undefined {
  const candidate = message.type ?? message.event ?? message.kind ?? message.action;
  return typeof candidate === 'string' ? candidate.toLowerCase() : undefined;
}

function isPingMessage(messageName: string): boolean {
  return messageName === 'ping' || messageName === 'heartbeat' || messageName.includes('ping');
}

function isHelloMessage(messageName: string): boolean {
  return (
    messageName === 'hello' ||
    messageName === 'hello_from_figma' ||
    messageName.startsWith('hello_') ||
    messageName.startsWith('hello-') ||
    messageName.includes('handshake') ||
    messageName === 'init' ||
    messageName === 'connect'
  );
}

function isSelectionMessage(messageName: string | undefined): boolean {
  if (!messageName) {
    return false;
  }

  return (
    messageName.includes('figma') ||
    messageName.includes('selection') ||
    messageName.includes('selectionchange') ||
    messageName.includes('node') ||
    messageName.includes('context') ||
    messageName.includes('design') ||
    messageName.includes('spec') ||
    messageName.includes('send') ||
    messageName.includes('import') ||
    messageName.includes('sync') ||
    messageName.includes('export') ||
    messageName.includes('snapshot') ||
    messageName.includes('frame') ||
    messageName.includes('document')
  );
}

function hasFigmaNodeData(value: unknown, depth = 0): boolean {
  if (depth > 4) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(item => hasFigmaNodeData(item, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  if (
    (typeof value.id === 'string' || typeof value.nodeId === 'string') &&
    (typeof value.name === 'string' || typeof value.type === 'string')
  ) {
    return true;
  }

  const figmaContextKeys = [
    'fileKey',
    'fileName',
    'pageName',
    'selection',
    'selectedNodes',
    'nodes',
    'node',
    'document',
    'children',
    'absoluteBoundingBox'
  ];

  if (figmaContextKeys.some(key => Object.prototype.hasOwnProperty.call(value, key))) {
    return true;
  }

  return ['payload', 'data', 'bundle', 'spec', 'context'].some(key => hasFigmaNodeData(value[key], depth + 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function describeMessage(value: unknown): string {
  if (!isRecord(value)) {
    return typeof value;
  }

  const messageName = readMessageName(value);
  const keys = Object.keys(value).slice(0, 8).join(', ');
  return messageName ? `${messageName} (${keys})` : `keys: ${keys}`;
}
