import type * as vscode from 'vscode';

export const FIGMA_BRIDGE_HOST = '127.0.0.1';
export const FIGMA_BRIDGE_PORT = 8080;
export const FIGMA_BRIDGE_URL = 'ws://localhost:8080';

export interface FigmaBridgeStatus {
  running: boolean;
  connected: boolean;
  port: 8080;
  url: 'ws://localhost:8080';
  lastPingAt?: string;
  lastPayloadAt?: string;
}

export interface FigmaWebSocketBridge {
  getStatus(): FigmaBridgeStatus;
  stop(): Promise<void>;
}

export interface NormalizedFigmaMessage {
  kind: 'figma-context' | 'ping' | 'unknown';
  payload?: unknown;
}

export type FigmaBridgeLogger = Pick<vscode.OutputChannel, 'appendLine' | 'show'>;
