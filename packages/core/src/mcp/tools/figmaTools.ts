import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { readLatestFigmaContextFromPath, StoredFigmaContext } from '../../shared/figmaStore';

const NO_CONTEXT_MESSAGE = 'No Figma context has been received yet. Please connect the Figma plugin to ws://localhost:8080 and send a selection.';
const DEFAULT_NODE_LIMIT = 50;
const MAX_NODE_LIMIT = 200;

interface FigmaNodeWithParent {
  node: Record<string, unknown>;
  parentName?: string;
}

export function registerFigmaTools(server: McpServer, figmaContextPath: string): void {
  server.registerTool('get_figma_context', {
    description: 'Return the latest Figma context received from the Figma WebSocket plugin.',
    inputSchema: {
      includeRaw: z.boolean().optional()
    }
  }, async ({ includeRaw }) => {
    const context = await readContext(figmaContextPath);

    if (!context) {
      return textResponse(NO_CONTEXT_MESSAGE);
    }

    if (includeRaw) {
      return jsonResponse(context);
    }

    return jsonResponse(summarizeFigmaContext(context));
  });

  server.registerTool('list_figma_nodes', {
    description: 'List Figma nodes from the latest imported selection.',
    inputSchema: {
      type: z.string().optional(),
      limit: z.number().int().positive().max(MAX_NODE_LIMIT).optional()
    }
  }, async ({ type, limit }) => {
    const context = await readContext(figmaContextPath);

    if (!context) {
      return textResponse(NO_CONTEXT_MESSAGE);
    }

    const requestedLimit = Math.min(limit ?? DEFAULT_NODE_LIMIT, MAX_NODE_LIMIT);
    const requestedType = type?.toLowerCase();
    const nodes = flattenFigmaNodes(context.payload)
      .filter(item => {
        if (!requestedType) {
          return true;
        }

        return readNodeType(item.node)?.toLowerCase() === requestedType;
      })
      .slice(0, requestedLimit)
      .map(toNodeListItem);

    return jsonResponse({
      count: nodes.length,
      limit: requestedLimit,
      type: type ?? undefined,
      nodes
    });
  });

  server.registerTool('get_figma_node_by_id', {
    description: 'Return a specific Figma node by node ID from the latest imported context.',
    inputSchema: {
      nodeId: z.string().min(1)
    }
  }, async ({ nodeId }) => {
    const context = await readContext(figmaContextPath);

    if (!context) {
      return textResponse(NO_CONTEXT_MESSAGE);
    }

    const match = flattenFigmaNodes(context.payload).find(item => readNodeId(item.node) === nodeId);

    if (!match) {
      return textResponse(`Figma node "${nodeId}" was not found in the latest imported context.`);
    }

    return jsonResponse(match.node);
  });
}

async function readContext(figmaContextPath: string): Promise<StoredFigmaContext | undefined> {
  if (!figmaContextPath) {
    return undefined;
  }

  return await readLatestFigmaContextFromPath(figmaContextPath);
}

function summarizeFigmaContext(context: StoredFigmaContext): Record<string, unknown> {
  const topLevelNodes = extractTopLevelNodes(context.payload);
  const allNodes = flattenFigmaNodes(context.payload);
  const selectedNodeCount = topLevelNodes.length > 0 ? topLevelNodes.length : allNodes.length;

  return {
    receivedAt: context.receivedAt,
    fileName: findFirstStringByKey(context.payload, ['fileName']),
    fileKey: findFirstStringByKey(context.payload, ['fileKey']),
    pageName: findFirstStringByKey(context.payload, ['pageName']),
    selectedNodeCount,
    topLevelNodeNames: topLevelNodes
      .map(readNodeName)
      .filter((name): name is string => Boolean(name))
  };
}

function flattenFigmaNodes(value: unknown): FigmaNodeWithParent[] {
  const result: FigmaNodeWithParent[] = [];
  const visited = new WeakSet<Record<string, unknown>>();
  const roots = extractTopLevelNodes(value);
  const startValue = roots.length > 0 ? roots : value;

  visitNodeContainer(startValue, undefined, result, visited);
  return result;
}

function visitNodeContainer(
  value: unknown,
  parentName: string | undefined,
  result: FigmaNodeWithParent[],
  visited: WeakSet<Record<string, unknown>>
): void {
  if (Array.isArray(value)) {
    value.forEach(item => visitNodeContainer(item, parentName, result, visited));
    return;
  }

  if (!isRecord(value) || visited.has(value)) {
    return;
  }

  visited.add(value);

  if (isFigmaNodeLike(value)) {
    result.push({ node: value, ...(parentName ? { parentName } : {}) });

    const currentParentName = readNodeName(value) ?? parentName;
    ['children', 'nodes', 'selection', 'selectedNodes'].forEach(key => {
      visitNodeContainer(value[key], currentParentName, result, visited);
    });
    return;
  }

  ['selection', 'selectedNodes', 'nodes', 'children', 'node', 'document', 'payload', 'data'].forEach(key => {
    visitNodeContainer(value[key], parentName, result, visited);
  });
}

function extractTopLevelNodes(value: unknown): Record<string, unknown>[] {
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

    const nestedNodes = extractTopLevelNodes(nested);
    if (nestedNodes.length > 0) {
      return nestedNodes;
    }
  }

  return isFigmaNodeLike(value) ? [value] : [];
}

function toNodeListItem(item: FigmaNodeWithParent): Record<string, unknown> {
  const dimensions = readNodeDimensions(item.node);

  return {
    id: readNodeId(item.node),
    name: readNodeName(item.node),
    type: readNodeType(item.node),
    ...(dimensions.width !== undefined ? { width: dimensions.width } : {}),
    ...(dimensions.height !== undefined ? { height: dimensions.height } : {}),
    ...(item.parentName ? { parentName: item.parentName } : {})
  };
}

function readNodeId(node: Record<string, unknown>): string | undefined {
  return readString(node.id) ?? readString(node.nodeId);
}

function readNodeName(node: Record<string, unknown>): string | undefined {
  return readString(node.name);
}

function readNodeType(node: Record<string, unknown>): string | undefined {
  return readString(node.type);
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

function findFirstStringByKey(value: unknown, keys: string[], depth = 0): string | undefined {
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

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textResponse(text: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text
      }
    ]
  };
}

function jsonResponse(value: unknown) {
  return textResponse(JSON.stringify(value, null, 2));
}
