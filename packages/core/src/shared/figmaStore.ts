import { promises as fs } from 'fs';
import path from 'path';
import * as vscode from 'vscode';

export const FIGMA_CONTEXT_RELATIVE_DIR = path.join('.project', 'figma', 'context');
export const FIGMA_CONTEXT_FILENAME = 'latest-figma-context.json';
export const FIGMA_BRIDGE_RELATIVE_DIR = path.join('.project', 'figma-bridge');
export const COMPONENT_MAPPINGS_FILENAME = 'component-mappings.json';

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

function resolveFigmaStorageDir(globalStorageFsPath: string): string {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    return path.join(workspaceRoot, FIGMA_CONTEXT_RELATIVE_DIR);
  }
  return path.join(globalStorageFsPath, 'figma');
}

function resolveFigmaBridgeDir(globalStorageFsPath: string): string {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    return path.join(workspaceRoot, FIGMA_BRIDGE_RELATIVE_DIR);
  }
  return path.join(globalStorageFsPath, 'figma-bridge');
}

export async function ensureFigmaStorage(context: vscode.ExtensionContext): Promise<string> {
  const figmaStoragePath = resolveFigmaStorageDir(context.globalStorageUri.fsPath);
  await fs.mkdir(figmaStoragePath, { recursive: true });
  return figmaStoragePath;
}

export async function ensureFigmaBridgeMappingFile(context: vscode.ExtensionContext): Promise<string> {
  const figmaBridgePath = resolveFigmaBridgeDir(context.globalStorageUri.fsPath);
  const mappingsPath = path.join(figmaBridgePath, COMPONENT_MAPPINGS_FILENAME);

  await fs.mkdir(figmaBridgePath, { recursive: true });

  try {
    await fs.access(mappingsPath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      throw error;
    }

    await fs.writeFile(
      mappingsPath,
      `${JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        mappings: []
      }, null, 2)}\n`,
      'utf8'
    );
  }

  return mappingsPath;
}

export function getFigmaContextPath(context: vscode.ExtensionContext): string {
  return path.join(resolveFigmaStorageDir(context.globalStorageUri.fsPath), FIGMA_CONTEXT_FILENAME);
}

export function getFigmaContextPathFromGlobalStorageUri(globalStorageUri: vscode.Uri): string {
  return path.join(resolveFigmaStorageDir(globalStorageUri.fsPath), FIGMA_CONTEXT_FILENAME);
}

export async function saveLatestFigmaContext(
  context: vscode.ExtensionContext,
  payload: unknown
): Promise<StoredFigmaContext> {
  const figmaStoragePath = await ensureFigmaStorage(context);
  await ensureFigmaBridgeMappingFile(context);

  // Extract asset bytes BEFORE writing the JSON so the on-disk JSON can
  // reference real files. We also strip the base64 payload from the
  // saved JSON — otherwise the file balloons by ~33% per asset for no
  // consumer benefit.
  const sanitisedPayload = await writeAssetsAndStripBase64(payload, figmaStoragePath);

  const storedContext: StoredFigmaContext = {
    source: 'figma-plugin-websocket',
    receivedAt: new Date().toISOString(),
    transport: 'websocket',
    server: {
      host: '127.0.0.1',
      port: 8080
    },
    payload: sanitisedPayload
  };

  // Write the file under a name derived from the selected Figma root
  // (e.g. `container.json`). The legacy `latest-figma-context.json` is
  // deleted so the directory always reflects the actual node name.
  // Readers (MCP env var, task-manager UI) transparently locate the
  // newest *.json via readLatestFigmaContextFromPath.
  const targetName = resolveTargetFilename(sanitisedPayload);
  const targetPath = path.join(figmaStoragePath, targetName);
  await fs.writeFile(
    targetPath,
    `${JSON.stringify(storedContext, null, 2)}\n`,
    'utf8'
  );

  if (targetName !== FIGMA_CONTEXT_FILENAME) {
    const legacyPath = path.join(figmaStoragePath, FIGMA_CONTEXT_FILENAME);
    try {
      await fs.unlink(legacyPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return storedContext;
}

function resolveTargetFilename(payload: unknown): string {
  const slug = readRootSlug(payload);
  if (!slug) return FIGMA_CONTEXT_FILENAME;
  const safe = slug.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe ? `${safe}.json` : FIGMA_CONTEXT_FILENAME;
}

function readRootSlug(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const nwa = p.nwa;
  if (nwa && typeof nwa === 'object') {
    const rootSlug = (nwa as Record<string, unknown>).rootSlug;
    if (typeof rootSlug === 'string' && rootSlug.length > 0) return rootSlug;
  }
  const figma = p.figma;
  if (figma && typeof figma === 'object') {
    const name = (figma as Record<string, unknown>).selectedNodeName;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  const screen = p.screen;
  if (screen && typeof screen === 'object') {
    const name = (screen as Record<string, unknown>).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return undefined;
}

interface IncomingAsset {
  type?: string;
  name?: string;
  path?: string;
  filePath?: string;
  base64?: string;
  format?: string;
  figmaNodeId?: string;
}

// Pulls every asset out of payload.assets[], writes its base64 bytes to
// <figma-context-dir>/<filePath> (e.g. .project/figma/context/icons/foo.svg),
// then returns the payload with `base64` removed from each asset entry so the
// JSON file on disk stays small.
async function writeAssetsAndStripBase64(
  payload: unknown,
  figmaStoragePath: string
): Promise<unknown> {
  if (!payload || typeof payload !== 'object') return payload;
  const p = payload as Record<string, unknown>;
  const assets = p.assets;
  if (!Array.isArray(assets) || assets.length === 0) return payload;

  // Resolve each asset to an absolute path and write the file.
  const writtenAssets: IncomingAsset[] = [];
  for (const raw of assets as IncomingAsset[]) {
    if (!raw || typeof raw !== 'object') {
      writtenAssets.push(raw);
      continue;
    }
    // Prefer filePath, fall back to the legacy "@icons/..." reference
    // (stripping the @ prefix) so older plugin builds still work.
    const filePathRaw = (raw.filePath || raw.path || '').toString();
    const filePath = filePathRaw.replace(/^@/, '');
    if (!filePath || !raw.base64) {
      writtenAssets.push({ ...raw, base64: undefined });
      continue;
    }
    // Guard against path traversal — never let the plugin write outside
    // the figma context directory.
    const safeRelative = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.join(figmaStoragePath, safeRelative);
    const absoluteDir = path.dirname(absolutePath);
    try {
      await fs.mkdir(absoluteDir, { recursive: true });
      const buffer = Buffer.from(raw.base64, 'base64');
      await fs.writeFile(absolutePath, buffer);
    } catch {
      // Swallow write failures — we still want the JSON written below so
      // the rest of the context survives.
    }
    // Replace with the stripped record (no base64 in the JSON).
    writtenAssets.push({ ...raw, base64: undefined, filePath: safeRelative });
  }

  return { ...p, assets: writtenAssets };
}

export async function readLatestFigmaContextFromPath(
  contextPath: string
): Promise<StoredFigmaContext | undefined> {
  try {
    const raw = await fs.readFile(contextPath, 'utf8');
    return JSON.parse(raw) as StoredFigmaContext;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') {
      throw error;
    }
  }

  // The canonical `latest-figma-context.json` no longer exists — the file
  // is now saved as `<rootSlug>.json`. Fall back to the most recently
  // modified JSON in the same directory so existing readers keep working.
  const newestPath = await findNewestContextFile(path.dirname(contextPath));
  if (!newestPath) return undefined;

  try {
    const raw = await fs.readFile(newestPath, 'utf8');
    return JSON.parse(raw) as StoredFigmaContext;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function findNewestContextFile(dir: string): Promise<string | undefined> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return undefined;
    throw error;
  }

  let newest: { path: string; mtimeMs: number } | undefined;
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const full = path.join(dir, entry);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      if (!newest || stat.mtimeMs > newest.mtimeMs) {
        newest = { path: full, mtimeMs: stat.mtimeMs };
      }
    } catch {
      // Skip entries we can't stat (broken symlinks, races).
    }
  }
  return newest?.path;
}
