import * as vscode from 'vscode';
import { FigmaBridgeStatus } from '../../figmaBridge/types';
import {
  getFigmaContextPathFromGlobalStorageUri,
  readLatestFigmaContextFromPath,
  StoredFigmaContext
} from '../../shared/figmaStore';
import { COMMANDS } from '../../utils/constants';

export type FigmaBridgeDetailAction = 'refresh' | 'start' | 'show' | 'stop';

export interface TaskFigmaBridgeItem {
  id?: string;
  name?: string;
  type?: string;
  width?: number;
  height?: number;
  parentName?: string;
}

export interface TaskFigmaBridgeDetail {
  status: FigmaBridgeStatus;
  contextPath?: string;
  receivedAt?: string;
  fileName?: string;
  fileKey?: string;
  pageName?: string;
  items: TaskFigmaBridgeItem[];
}

export class FigmaBridgeDetailService {
  constructor(
    private readonly storageUri?: vscode.Uri,
    private readonly commandGateway: Pick<typeof vscode.commands, 'executeCommand'> = vscode.commands
  ) {}

  async loadDetail(action: FigmaBridgeDetailAction): Promise<TaskFigmaBridgeDetail> {
    await this.applyBridgeAction(action);
    return this.getDetail();
  }

  async getDetail(): Promise<TaskFigmaBridgeDetail> {
    const status = await this.getStatus();
    const contextPath = this.storageUri
      ? getFigmaContextPathFromGlobalStorageUri(this.storageUri)
      : undefined;
    const context = contextPath
      ? await readLatestFigmaContextFromPath(contextPath)
      : undefined;

    return {
      status,
      contextPath,
      receivedAt: context?.receivedAt,
      fileName: findFirstStringByKey(context?.payload, ['fileName']),
      fileKey: findFirstStringByKey(context?.payload, ['fileKey']),
      pageName: findFirstStringByKey(context?.payload, ['pageName']),
      items: context ? flattenFigmaBridgeItems(context).slice(0, 200) : []
    };
  }

  private async applyBridgeAction(action: FigmaBridgeDetailAction): Promise<void> {
    if (action === 'start') {
      await this.commandGateway.executeCommand(COMMANDS.FIGMA_MCP_BRIDGE_START);
      return;
    }

    if (action === 'stop') {
      await this.commandGateway.executeCommand(COMMANDS.FIGMA_MCP_BRIDGE_STOP);
    }
  }

  private async getStatus(): Promise<FigmaBridgeStatus> {
    const status = await this.commandGateway.executeCommand<FigmaBridgeStatus>(COMMANDS.FIGMA_MCP_BRIDGE_GET_STATUS);

    return status || {
      running: false,
      connected: false,
      port: 8080,
      url: 'ws://localhost:8080'
    };
  }
}

export function flattenFigmaBridgeItems(context: StoredFigmaContext): TaskFigmaBridgeItem[] {
  const result: TaskFigmaBridgeItem[] = [];
  const visited = new WeakSet<Record<string, unknown>>();
  const roots = extractTopLevelFigmaNodes(context.payload);
  visitFigmaNodeContainer(roots.length > 0 ? roots : context.payload, undefined, result, visited);
  return result;
}

function visitFigmaNodeContainer(
  value: unknown,
  parentName: string | undefined,
  result: TaskFigmaBridgeItem[],
  visited: WeakSet<Record<string, unknown>>
): void {
  if (Array.isArray(value)) {
    value.forEach(item => visitFigmaNodeContainer(item, parentName, result, visited));
    return;
  }

  if (!isRecord(value) || visited.has(value)) {
    return;
  }

  visited.add(value);

  if (isFigmaNodeLike(value)) {
    const dimensions = readNodeDimensions(value);
    const item: TaskFigmaBridgeItem = {
      id: readString(value.id) ?? readString(value.nodeId),
      name: readString(value.name),
      type: readString(value.type),
      ...(dimensions.width !== undefined ? { width: dimensions.width } : {}),
      ...(dimensions.height !== undefined ? { height: dimensions.height } : {}),
      ...(parentName ? { parentName } : {})
    };

    result.push(item);

    const nextParentName = item.name ?? parentName;
    ['children', 'nodes', 'selection', 'selectedNodes'].forEach(key => {
      visitFigmaNodeContainer(value[key], nextParentName, result, visited);
    });
    return;
  }

  ['selection', 'selectedNodes', 'nodes', 'children', 'node', 'document', 'payload', 'data'].forEach(key => {
    visitFigmaNodeContainer(value[key], parentName, result, visited);
  });
}

function extractTopLevelFigmaNodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of ['selection', 'selectedNodes', 'nodes']) {
    if (Array.isArray(value[key])) {
      return value[key].filter(isRecord);
    }
  }

  for (const key of ['node', 'document', 'payload', 'data']) {
    const nested = value[key];
    if (isRecord(nested) && isFigmaNodeLike(nested)) {
      return [nested];
    }

    const nestedNodes = extractTopLevelFigmaNodes(nested);
    if (nestedNodes.length > 0) {
      return nestedNodes;
    }
  }

  return isFigmaNodeLike(value) ? [value] : [];
}

export function findFirstStringByKey(value: unknown, keys: string[], depth = 0): string | undefined {
  if (depth > 6) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findFirstStringByKey(item, keys, depth + 1);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of keys) {
    const candidate = readString(value[key]);
    if (candidate) {
      return candidate;
    }
  }

  for (const item of Object.values(value)) {
    const match = findFirstStringByKey(item, keys, depth + 1);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function isFigmaNodeLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' ||
    typeof value.nodeId === 'string' ||
    (typeof value.name === 'string' && typeof value.type === 'string') ||
    Array.isArray(value.children)
  );
}

function readNodeDimensions(node: Record<string, unknown>): { width?: number; height?: number } {
  const absoluteBoundingBox = isRecord(node.absoluteBoundingBox) ? node.absoluteBoundingBox : undefined;
  const bounds = isRecord(node.bounds) ? node.bounds : undefined;
  const size = isRecord(node.size) ? node.size : undefined;

  return {
    width: readNumber(node.width) ?? readNumber(absoluteBoundingBox?.width) ?? readNumber(bounds?.width) ?? readNumber(size?.width),
    height: readNumber(node.height) ?? readNumber(absoluteBoundingBox?.height) ?? readNumber(bounds?.height) ?? readNumber(size?.height)
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
