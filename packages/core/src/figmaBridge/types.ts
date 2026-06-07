import type * as vscode from 'vscode';
import type { StoredComponentMapping } from '../services/FigmaMappingService';

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

export type NormalizedFigmaMessage =
  | { kind: 'ping' }
  | {
      kind: 'hello';
      info: {
        pluginName?: string;
        version?: string;
        figmaFileName?: string;
        figmaPageName?: string;
      };
    }
  | { kind: 'figma-context'; payload: unknown; requestId?: string }
  | { kind: 'save-mapping'; mapping: StoredComponentMapping }
  | { kind: 'delete-mapping'; mappingId: string }
  | { kind: 'request-catalog'; requestId?: string }
  | { kind: 'request-project-mappings'; requestId?: string }
  | { kind: 'unknown' };

export type FigmaBridgeLogger = Pick<vscode.OutputChannel, 'appendLine' | 'show'>;
