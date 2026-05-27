import type * as vscode from 'vscode';
import WebSocket, { type RawData, WebSocketServer } from 'ws';
import { ensureFigmaStorage, saveLatestFigmaContext } from '../shared/figmaStore';
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
      socket.send(JSON.stringify({ type: 'hello_ack', receivedAt }));
    }
    return;
  }

  if (normalized.kind === 'figma-context') {
    await saveLatestFigmaContext(context, normalized.payload);
    markPayload(receivedAt);
    outputChannel.appendLine(`[${receivedAt}] Saved latest Figma context from WebSocket message`);

    if (socket.readyState === WebSocket.OPEN) {
      const requestId = isRecord(parsed.value) ? readString(parsed.value.requestId) : undefined;
      socket.send(JSON.stringify({
        type: 'design_spec_ack',
        ...(requestId ? { requestId } : {}),
        receivedAt
      }));
    }
    return;
  }

  outputChannel.appendLine(`[${receivedAt}] Unknown Figma bridge message ignored: ${describeMessage(parsed.value)}`);
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
