import * as path from 'path';
import { promises as fs } from 'fs';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

// Shape mirrored from the Figma plugin's ComponentMapping type. Kept here as a
// local interface so the VS Code extension does not need to import from the
// figma-plugin folder (different tsconfig).
export interface StoredComponentMapping {
  id: string;
  figmaName: string;
  figmaNodeId?: string;
  figmaComponentKey?: string;
  figmaVariant?: Record<string, string>;
  codeComponent: string;
  codeFilePath: string;
  importType: 'default' | 'named';
  importName?: string;
  propMapping?: Record<string, string>;
  defaultProps?: Record<string, unknown>;
  mergeChildProps?: boolean;
  confidence: number;
  source: 'manual' | 'auto-suggested' | 'confirmed';
  updatedAt: string;
  previewUiUrl?: string;
  description?: string;
}

export interface StoredMappingFile {
  version: number;
  updatedAt: string;
  mappings: StoredComponentMapping[];
}

export const FIGMA_BRIDGE_DIR = path.join('.project', 'figma-bridge');
export const COMPONENT_MAPPINGS_FILE = 'component-mappings.json';
const FILE_VERSION = 1;

// Read/write the project-level component mapping registry. Lives inside
// `.project/figma-bridge/component-mappings.json` so it can be committed to
// git and shared with the team. The Figma plugin's clientStorage stays as a
// local working cache; this file is the source of truth.
export class FigmaMappingService {
  private readonly workspaceRoot: string | undefined;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  get mappingsPath(): string | undefined {
    if (!this.workspaceRoot) {
      return undefined;
    }
    return path.join(this.workspaceRoot, FIGMA_BRIDGE_DIR, COMPONENT_MAPPINGS_FILE);
  }

  async ensureDir(): Promise<void> {
    const target = this.mappingsPath;
    if (!target) {
      return;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
  }

  async ensureFile(): Promise<void> {
    const target = this.mappingsPath;
    if (!target) {
      return;
    }

    await this.ensureDir();

    try {
      await fs.access(target);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code !== 'ENOENT') {
        throw error;
      }

      await this.writeAll([]);
    }
  }

  async loadAll(): Promise<StoredComponentMapping[]> {
    const target = this.mappingsPath;
    if (!target) {
      return [];
    }
    try {
      const raw = await fs.readFile(target, 'utf8');
      const parsed = JSON.parse(raw) as StoredMappingFile;
      return Array.isArray(parsed?.mappings) ? parsed.mappings : [];
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code !== 'ENOENT') {
        logger.warn(`Failed to read project mappings: ${nodeError.message}`);
      }
      return [];
    }
  }

  async upsert(mapping: StoredComponentMapping): Promise<void> {
    if (!this.mappingsPath) {
      return;
    }
    const list = await this.loadAll();
    const idx = list.findIndex(m => m.id === mapping.id);
    if (idx >= 0) {
      list[idx] = mapping;
    } else {
      list.push(mapping);
    }
    await this.writeAll(list);
  }

  async upsertMany(mappings: StoredComponentMapping[]): Promise<number> {
    if (!this.mappingsPath) {
      return 0;
    }

    const list = await this.loadAll();
    let changed = false;

    for (const mapping of mappings) {
      const idx = list.findIndex(m => m.id === mapping.id);
      if (idx >= 0) {
        list[idx] = mapping;
      } else {
        list.push(mapping);
      }
      changed = true;
    }

    if (changed) {
      await this.writeAll(list);
      return mappings.length;
    }

    await this.ensureFile();
    return 0;
  }

  async delete(id: string): Promise<void> {
    if (!this.mappingsPath) {
      return;
    }
    const list = await this.loadAll();
    const next = list.filter(m => m.id !== id);
    if (next.length === list.length) {
      return;
    }
    await this.writeAll(next);
  }

  async writeAll(list: StoredComponentMapping[]): Promise<void> {
    const target = this.mappingsPath;
    if (!target) {
      return;
    }
    await this.ensureDir();
    const payload: StoredMappingFile = {
      version: FILE_VERSION,
      updatedAt: new Date().toISOString(),
      mappings: list
    };
    await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}
