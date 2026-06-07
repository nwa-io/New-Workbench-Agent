import * as https from 'https';
import type { TaskFigmaNode } from '@nwa/workflow-sdk';

const FIGMA_NODE_LIST_MAX_DEPTH = 2;

export interface ParsedFigmaLink {
  fileKey: string;
  link: string;
  nodeId?: string;
}

export interface FigmaApiResponse {
  name?: string;
  document?: FigmaDocumentNode;
  err?: string;
  message?: string;
}

export interface FigmaDocumentNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaDocumentNode[];
}

/**
 * Self-contained Figma collection strategy: parses Figma links, calls the Figma
 * REST API, and flattens the document into selectable nodes. Stateless and
 * depends only on the workflow SDK types — change how Figma is read here without
 * touching core.
 */
export class FigmaClient {
  parseLink(link: string): ParsedFigmaLink {
    const trimmedLink = link.trim();

    if (!trimmedLink) {
      throw new Error('Paste a Figma link before syncing.');
    }

    let url: URL;
    try {
      url = new URL(trimmedLink);
    } catch {
      throw new Error('Paste a valid Figma link.');
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'figma.com' && !hostname.endsWith('.figma.com')) {
      throw new Error('Paste a valid Figma link.');
    }

    const pathParts = url.pathname
      .split('/')
      .filter(Boolean)
      .map(part => decodeURIComponent(part));
    const fileTypeIndex = pathParts.findIndex(part => ['design', 'file', 'proto', 'board'].includes(part));
    const fileKey = fileTypeIndex >= 0 ? pathParts[fileTypeIndex + 1] : undefined;

    if (!fileKey || !/^[A-Za-z0-9_-]+$/.test(fileKey)) {
      throw new Error('The Figma link is missing a file key.');
    }

    const nodeIdParam = url.searchParams.get('node-id');
    const nodeId = nodeIdParam ? decodeURIComponent(nodeIdParam).replace(/-/g, ':') : undefined;

    return {
      fileKey,
      link: url.toString(),
      nodeId
    };
  }

  async fetchFile(figmaLink: ParsedFigmaLink, token: string): Promise<FigmaApiResponse> {
    const fileKey = encodeURIComponent(figmaLink.fileKey);
    const requestPath = `/v1/files/${fileKey}`;

    return this.requestFigmaApi(requestPath, token);
  }

  getNodes(response: FigmaApiResponse): TaskFigmaNode[] {
    if (!response.document) {
      return [];
    }

    const nodes: TaskFigmaNode[] = [];
    this.collectFigmaNodes(response.document, [], 0, nodes);
    return nodes;
  }

  ensureNodeExists(response: FigmaApiResponse, nodeId?: string): void {
    if (!nodeId) {
      return;
    }

    if (!response.document || !this.findFigmaNode(response.document, nodeId)) {
      throw new Error(`Figma node ${nodeId} was not found in this file.`);
    }
  }

  getNodeName(response: FigmaApiResponse, nodeId?: string): string | undefined {
    if (!nodeId) {
      return undefined;
    }

    return response.document ? this.findFigmaNode(response.document, nodeId)?.name : undefined;
  }

  getUniqueNodeIds(nodeIds: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const nodeId of nodeIds) {
      const cleanNodeId = String(nodeId || '').trim();

      if (cleanNodeId && !seen.has(cleanNodeId)) {
        seen.add(cleanNodeId);
        result.push(cleanNodeId);
      }
    }

    return result;
  }

  private requestFigmaApi(requestPath: string, token: string): Promise<FigmaApiResponse> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      headers['X-Figma-Token'] = token;
      headers['User-Agent'] = 'NWA-vscode';

      const request = https.request(
        {
          hostname: 'api.figma.com',
          path: requestPath,
          method: 'GET',
          headers
        },
        response => {
          const chunks: Buffer[] = [];

          response.on('data', chunk => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          response.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const payload = this.parseFigmaApiResponse(body);
            const statusCode = response.statusCode || 0;

            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(this.getFigmaApiErrorMessage(statusCode, payload, body)));
              return;
            }

            resolve(payload);
          });
        }
      );

      request.on('error', error => {
        reject(new Error(`Unable to reach Figma API: ${error.message}`));
      });

      request.setTimeout(20000, () => {
        request.destroy(new Error('Figma API request timed out.'));
      });

      request.end();
    });
  }

  private parseFigmaApiResponse(body: string): FigmaApiResponse {
    if (!body.trim()) {
      return {};
    }

    try {
      return JSON.parse(body) as FigmaApiResponse;
    } catch {
      return { message: body };
    }
  }

  private getFigmaApiErrorMessage(statusCode: number, payload: FigmaApiResponse, body: string): string {
    if (statusCode === 403) {
      return 'Figma rejected the token or the token does not have access to this file.';
    }

    if (statusCode === 404) {
      return 'Figma file was not found or is not accessible.';
    }

    const detail = payload.err || payload.message || body;
    return detail
      ? `Figma API returned ${statusCode}: ${String(detail).slice(0, 300)}`
      : `Figma API returned ${statusCode}.`;
  }

  private collectFigmaNodes(
    node: FigmaDocumentNode,
    parentPath: string[],
    depth: number,
    nodes: TaskFigmaNode[]
  ): void {
    const nodeName = node.name || node.id;
    const nodePath = [...parentPath, nodeName];

    nodes.push({
      id: node.id,
      name: nodeName,
      type: node.type || 'UNKNOWN',
      depth,
      path: nodePath.join(' / ')
    });

    if (depth >= FIGMA_NODE_LIST_MAX_DEPTH) {
      return;
    }

    for (const child of node.children || []) {
      this.collectFigmaNodes(child, nodePath, depth + 1, nodes);
    }
  }

  private findFigmaNode(node: FigmaDocumentNode, nodeId: string): FigmaDocumentNode | undefined {
    if (node.id === nodeId) {
      return node;
    }

    for (const child of node.children || []) {
      const match = this.findFigmaNode(child, nodeId);
      if (match) {
        return match;
      }
    }

    return undefined;
  }
}
