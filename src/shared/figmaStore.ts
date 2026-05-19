import { promises as fs } from 'fs';
import path from 'path';
import type * as vscode from 'vscode';

export interface StoredFigmaContext {
  source: 'figma-plugin-websocket';
  receivedAt: string;
  transport: 'websocket';
  server: {
    host: '127.0.0.1';
    port: 8080;
  };
  payload: unknown;
}

export async function ensureFigmaStorage(context: vscode.ExtensionContext): Promise<string> {
  const figmaStoragePath = path.join(context.globalStorageUri.fsPath, 'figma');
  await fs.mkdir(figmaStoragePath, { recursive: true });
  return figmaStoragePath;
}

export function getFigmaContextPath(context: vscode.ExtensionContext): string {
  return getFigmaContextPathFromGlobalStorageUri(context.globalStorageUri);
}

export function getFigmaContextPathFromGlobalStorageUri(globalStorageUri: vscode.Uri): string {
  return path.join(globalStorageUri.fsPath, 'figma', 'latest-figma-context.json');
}

export async function saveLatestFigmaContext(
  context: vscode.ExtensionContext,
  payload: unknown
): Promise<StoredFigmaContext> {
  await ensureFigmaStorage(context);

  const storedContext: StoredFigmaContext = {
    source: 'figma-plugin-websocket',
    receivedAt: new Date().toISOString(),
    transport: 'websocket',
    server: {
      host: '127.0.0.1',
      port: 8080
    },
    payload
  };

  await fs.writeFile(
    getFigmaContextPath(context),
    `${JSON.stringify(storedContext, null, 2)}\n`,
    'utf8'
  );

  return storedContext;
}

export async function readLatestFigmaContextFromPath(
  contextPath: string
): Promise<StoredFigmaContext | undefined> {
  try {
    const raw = await fs.readFile(contextPath, 'utf8');
    return JSON.parse(raw) as StoredFigmaContext;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}
