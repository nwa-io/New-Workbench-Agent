import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as https from 'https';
import type { BrowserContext, Page } from 'playwright';
import { execFile } from 'child_process';
import { createRequire } from 'module';
import { promisify } from 'util';
import { ConfigService } from './ConfigService';
import { FileSystemService } from './FileSystemService';
import { logger } from '../utils/logger';
import {
  TaskDocument,
  TaskDocumentUpload,
  TaskFigmaConnection,
  TaskFigmaNodeSelectionRequest,
  TaskFigmaNode,
  TaskFigmaSyncRequest,
  TaskItemCreateRequest,
  TaskItemDeleteRequest,
  TaskItemSelectRequest,
  TaskItemType,
  TaskJiraConnection,
  TaskJiraOpenRequest,
  TaskJiraReadRequest,
  TaskJiraTicket,
  TaskMarkdownContent,
  TaskMarkdownRequest,
  TaskMarkdownUpdateRequest,
  TaskManagerItem,
  TaskManagerMode,
  TaskManagerState,
  TaskProcessNode
} from '../models/TaskManager';

const execFileAsync = promisify(execFile);
const PROJECT_FOLDER = '.project';
const PROJECT_FIGMA_FOLDER = '.project/figma';
const DEFAULT_TASK_DOCUMENTS_FOLDER = '.project/docs';
const MARKITDOWN_MAX_BUFFER = 100 * 1024 * 1024;
const FIGMA_NODE_LIST_MAX_DEPTH = 2;
const JIRA_BROWSER_PROFILE_FOLDER = 'jira-playwright-profile';
const JIRA_PAGE_TIMEOUT_MS = 60000;
const TASK_MARKDOWN_DOCUMENT_LIMIT = 5;
const TASK_MARKDOWN_DOCUMENT_CHAR_LIMIT = 1400;
const TASK_MARKDOWN_GUIDE_RELATIVE_PATH = ['webview', 'execution', 'condensed', 'guide.md'];
const TASK_MARKDOWN_BUNDLED_GUIDE_RELATIVE_PATH = ['execution', 'condensed', 'guide.md'];
const JIRA_MARKDOWN_FILE_NAME = 'jira.md';
const FIGMA_CACHE_SCHEMA_VERSION = 1;
const JIRA_CACHE_PREFIX = 'agentkit:jira:';
const TASK_ITEM_FOLDERS: Record<TaskItemType, string> = {
  task: 'task',
  bug: 'bug'
};
const TASK_TYPE_TO_MODE: Record<TaskItemType, TaskManagerMode> = {
  task: 'task',
  bug: 'fix-bug'
};

function getTaskItemTypeForMode(mode: TaskManagerMode): TaskItemType {
  return mode === 'fix-bug' ? 'bug' : 'task';
}

interface MarkitdownCandidate {
  command: string;
  args: string[];
  label: string;
}

interface ParsedFigmaLink {
  fileKey: string;
  link: string;
  nodeId?: string;
}

interface FigmaApiResponse {
  name?: string;
  document?: FigmaDocumentNode;
  err?: string;
  message?: string;
}

interface FigmaDocumentNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaDocumentNode[];
}

export class TaskManagerService {
  private configService: ConfigService;
  private fileSystemService: FileSystemService;
  private storageUri?: vscode.Uri;
  private extensionUri?: vscode.Uri;
  private currentItem?: TaskManagerItem;
  private figmaConnection?: TaskFigmaConnection;
  private jiraConnection?: TaskJiraConnection;
  private jiraBrowserContext?: BrowserContext;
  private jiraPage?: Page;
  private taskMarkdownContentByItem: Record<string, string> = {};
  private taskMarkdownUpdatedAtByItem: Record<string, string> = {};

  constructor(
    configService?: ConfigService,
    fileSystemService?: FileSystemService,
    storageUri?: vscode.Uri,
    extensionUri?: vscode.Uri
  ) {
    this.configService = configService || new ConfigService();
    this.fileSystemService = fileSystemService || new FileSystemService();
    this.storageUri = storageUri;
    this.extensionUri = extensionUri;
  }

  async getState(
    mode: TaskManagerMode,
    itemReference?: { itemId?: string; itemType?: TaskItemType }
  ): Promise<TaskManagerState> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      return {
        mode,
        items: [],
        projectFolder: PROJECT_FOLDER,
        documentsFolder: this.getDocumentsRelativeFolder(),
        documents: [],
        nodes: this.getProcessNodes('Unknown', 'Missing'),
        figma: undefined,
        jira: undefined
      };
    }

    const items = await this.listTaskItems(workspaceFolder);
    const currentItem = this.resolveStateItem(items, mode, itemReference);
    const stateMode = currentItem ? TASK_TYPE_TO_MODE[currentItem.type] : mode;
    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    const documents = await this.listMarkdownDocuments(workspaceFolder, documentsFolderUri);
    const documentStatus = documents.length > 0 ? 'Ready' : 'Missing';
    const loadedFigmaConnection = currentItem ? await this.readFigmaConnection(workspaceFolder, currentItem) : undefined;
    const loadedJiraConnection = currentItem ? await this.readJiraConnection(workspaceFolder, currentItem) : undefined;

    if (currentItem) {
      this.currentItem = currentItem;
      this.figmaConnection = loadedFigmaConnection;
      this.jiraConnection = loadedJiraConnection;
    } else {
      this.currentItem = undefined;
      this.figmaConnection = undefined;
      this.jiraConnection = undefined;
    }

    return {
      mode: stateMode,
      items,
      currentItem,
      projectFolder: PROJECT_FOLDER,
      documentsFolder,
      documents,
      nodes: this.getProcessNodes(
        documentStatus,
        this.getMarkdownStatus(documents.length > 0, currentItem, loadedFigmaConnection, loadedJiraConnection),
        loadedFigmaConnection,
        loadedJiraConnection
      ),
      figma: loadedFigmaConnection,
      jira: loadedJiraConnection
    };
  }

  async createTaskItem(
    request: TaskItemCreateRequest
  ): Promise<{ item: TaskManagerItem; state: TaskManagerState }> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const itemType = this.normalizeTaskItemType(request.type);
    const itemId = this.normalizeTaskItemId(request.id);
    const itemFolderUri = this.getTaskItemFolderUri(workspaceFolder, itemType, itemId);

    await vscode.workspace.fs.createDirectory(itemFolderUri);
    await vscode.workspace.fs.createDirectory(this.getProjectTypeFolderUri(workspaceFolder, itemType));
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder, ...PROJECT_FIGMA_FOLDER.split('/')));

    const item = await this.getTaskItem(workspaceFolder, itemType, itemId);
    this.currentItem = item;
    this.figmaConnection = undefined;
    this.jiraConnection = undefined;

    const state = await this.getState(TASK_TYPE_TO_MODE[itemType], {
      itemId,
      itemType
    });
    return { item, state };
  }

  async selectTaskItem(
    request: TaskItemSelectRequest
  ): Promise<{ item: TaskManagerItem; state: TaskManagerState }> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const itemType = this.normalizeTaskItemType(request.type);
    const itemId = this.normalizeTaskItemId(request.id);
    const item = await this.getTaskItem(workspaceFolder, itemType, itemId);

    if (!await this.uriExists(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id))) {
      throw new Error(`${this.getTaskItemTypeLabel(item.type)} ${item.id} was not found.`);
    }

    this.currentItem = item;
    this.figmaConnection = await this.readFigmaConnection(workspaceFolder, item);
    this.jiraConnection = await this.readJiraConnection(workspaceFolder, item);

    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });
    return { item, state };
  }

  async deleteTaskItem(
    request: TaskItemDeleteRequest
  ): Promise<{ items: TaskManagerItem[]; state: TaskManagerState }> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const itemType = this.normalizeTaskItemType(request.type);
    const itemId = this.normalizeTaskItemId(request.id);
    const item = await this.getTaskItem(workspaceFolder, itemType, itemId);

    await this.deleteUriIfExists(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id), {
      recursive: true,
      useTrash: true
    });
    await this.deleteUriIfExists(this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id), {
      recursive: false,
      useTrash: true
    });
    await this.deleteUriIfExists(this.getLegacyTaskItemMarkdownUri(workspaceFolder, item.type, item.id), {
      recursive: false,
      useTrash: true
    });
    await this.deleteUriIfExists(this.getFigmaCacheUri(workspaceFolder, item.type, item.id), {
      recursive: false,
      useTrash: true
    });

    if (this.currentItem?.id === item.id && this.currentItem.type === item.type) {
      this.currentItem = undefined;
      this.figmaConnection = undefined;
      this.jiraConnection = undefined;
    }

    const state = await this.getState(TASK_TYPE_TO_MODE[item.type]);
    return {
      items: state.items,
      state
    };
  }

  async importDocument(upload: TaskDocumentUpload): Promise<{ document: TaskDocument; state: TaskManagerState }> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    if (!upload.fileName || !upload.contentBase64) {
      throw new Error('Missing document upload data');
    }

    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    await vscode.workspace.fs.createDirectory(documentsFolderUri);

    const sourceBuffer = Buffer.from(upload.contentBase64, 'base64');
    const parsedName = path.parse(upload.fileName);
    const safeBaseName = this.getSafeBaseName(parsedName.name);
    const targetUri = await this.getUniqueMarkdownUri(documentsFolderUri, safeBaseName);

    if (this.isMarkdownFile(parsedName.ext)) {
      await vscode.workspace.fs.writeFile(targetUri, sourceBuffer);
    } else {
      const markdown = await this.convertToMarkdown(sourceBuffer, safeBaseName, parsedName.ext);
      await vscode.workspace.fs.writeFile(targetUri, Buffer.from(markdown, 'utf8'));
    }

    const document = {
      name: path.basename(targetUri.fsPath),
      workspacePath: this.toWorkspacePath(workspaceFolder.fsPath, targetUri.fsPath)
    };

    const state = await this.getState(upload.mode || 'task', {
      itemId: upload.itemId,
      itemType: upload.itemType
    });
    return { document, state };
  }

  async syncFigmaLink(
    request: TaskFigmaSyncRequest
  ): Promise<{ connection: TaskFigmaConnection; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const token = request.token.trim();

    if (!token) {
      throw new Error('Paste a Figma token before syncing.');
    }

    const figmaLink = this.parseFigmaLink(request.link);
    const response = await this.fetchFigmaFile(figmaLink, token);
    const figmaNodes = this.getFigmaNodes(response);
    this.ensureRequestedFigmaNodeExists(response, figmaLink.nodeId);
    const selectedNodeIds = this.getInitialFigmaSelectedNodeIds(figmaNodes, figmaLink);

    const connection: TaskFigmaConnection = {
      link: figmaLink.link,
      fileKey: figmaLink.fileKey,
      nodeId: figmaLink.nodeId,
      fileName: response.name || figmaLink.fileKey,
      nodeName: this.getFigmaNodeName(response, figmaLink.nodeId),
      lastSyncedAt: new Date().toISOString(),
      nodes: figmaNodes,
      selectedNodeIds
    };

    this.figmaConnection = connection;
    await this.writeFigmaConnection(workspaceFolder, item, connection);
    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });
    return { connection, state };
  }

  async updateFigmaNodeSelection(
    request: TaskFigmaNodeSelectionRequest
  ): Promise<{ connection: TaskFigmaConnection; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);

    if (!this.figmaConnection) {
      this.figmaConnection = await this.readFigmaConnection(workspaceFolder, item);
    }

    if (!this.figmaConnection) {
      throw new Error('Sync a Figma link before selecting nodes.');
    }

    const availableNodeIds = new Set(this.figmaConnection.nodes.map(node => node.id));
    const selectedNodeIds = this.getUniqueFigmaNodeIds(request.selectedNodeIds)
      .filter(nodeId => availableNodeIds.has(nodeId));

    this.figmaConnection = {
      ...this.figmaConnection,
      selectedNodeIds
    };
    await this.writeFigmaConnection(workspaceFolder, item, this.figmaConnection);

    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });
    return { connection: this.figmaConnection, state };
  }

  async getTaskMarkdown(
    request: TaskMarkdownRequest
  ): Promise<{ markdown: TaskMarkdownContent; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const mode = TASK_TYPE_TO_MODE[item.type];
    const itemKey = this.getTaskItemKey(item);
    const generatedAt = new Date().toISOString();

    if (request.regenerate) {
      this.taskMarkdownContentByItem[itemKey] = await this.generateTaskMarkdown(mode, item);
      this.taskMarkdownUpdatedAtByItem[itemKey] = generatedAt;
      await this.writeTaskMarkdown(workspaceFolder, item, this.taskMarkdownContentByItem[itemKey]);
    }

    const cachedContent = this.taskMarkdownContentByItem[itemKey] || await this.readTaskMarkdown(workspaceFolder, item);
    let content = cachedContent;

    if (!content) {
      content = await this.generateTaskMarkdown(mode, item);
      this.taskMarkdownContentByItem[itemKey] = content;
      this.taskMarkdownUpdatedAtByItem[itemKey] = generatedAt;
      await this.writeTaskMarkdown(workspaceFolder, item, content);
    }

    const updatedAt = this.taskMarkdownUpdatedAtByItem[itemKey] || await this.getTaskMarkdownUpdatedAt(workspaceFolder, item);
    const state = await this.getState(mode, {
      itemId: item.id,
      itemType: item.type
    });

    return {
      markdown: {
        content,
        updatedAt,
        generatedAt
      },
      state
    };
  }

  async updateTaskMarkdown(
    request: TaskMarkdownUpdateRequest
  ): Promise<{ markdown: TaskMarkdownContent; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const mode = TASK_TYPE_TO_MODE[item.type];
    const itemKey = this.getTaskItemKey(item);
    this.taskMarkdownContentByItem[itemKey] = request.content;
    this.taskMarkdownUpdatedAtByItem[itemKey] = new Date().toISOString();
    await this.writeTaskMarkdown(workspaceFolder, item, request.content);
    const updatedAt = this.taskMarkdownUpdatedAtByItem[itemKey] as string;
    const state = await this.getState(mode, {
      itemId: item.id,
      itemType: item.type
    });

    return {
      markdown: {
        content: request.content,
        updatedAt,
        generatedAt: updatedAt
      },
      state
    };
  }

  async openJiraInChrome(
    request: TaskJiraOpenRequest
  ): Promise<{ connection: TaskJiraConnection; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const jiraLink = this.parseJiraLink(request.link);
    const { profilePath } = await this.openJiraPage(jiraLink);
    const connection: TaskJiraConnection = {
      ...this.jiraConnection,
      link: jiraLink,
      profilePath,
      lastOpenedAt: new Date().toISOString()
    };

    this.jiraConnection = connection;
    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });
    return { connection, state };
  }

  async readJiraTicket(
    request: TaskJiraReadRequest
  ): Promise<{ connection: TaskJiraConnection; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const jiraLink = this.parseJiraLink(request.link || this.jiraConnection?.link || '');
    const { page, profilePath } = await this.openJiraPage(jiraLink);

    await page.waitForLoadState('domcontentloaded', { timeout: JIRA_PAGE_TIMEOUT_MS }).catch(() => undefined);
    await page.waitForTimeout(1200);

    if (this.isJiraLoginPage(page.url())) {
      throw new Error('Jira is still on the login page. Log in in Chrome, then click Read ticket again.');
    }

    const ticket = await this.extractJiraTicket(page, jiraLink);
    const readAt = ticket.lastReadAt;
    const connection: TaskJiraConnection = {
      ...this.jiraConnection,
      link: jiraLink,
      profilePath,
      lastOpenedAt: this.jiraConnection?.lastOpenedAt || readAt,
      lastReadAt: readAt,
      ticket
    };

    this.jiraConnection = connection;
    await this.writeJiraConnection(workspaceFolder, item, connection);
    await this.ensureTaskMarkdownExists(workspaceFolder, item);
    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });
    await this.closeJiraBrowser();
    return { connection, state };
  }

  async openDocument(workspacePath: string): Promise<void> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const safeParts = workspacePath
      .split(/[\\/]+/)
      .filter(Boolean);

    if (safeParts.length === 0 || safeParts.includes('..')) {
      throw new Error('Invalid document path');
    }

    const documentUri = vscode.Uri.joinPath(workspaceFolder, ...safeParts);
    const document = await vscode.workspace.openTextDocument(documentUri);
    await vscode.window.showTextDocument(document);
  }

  private getProcessNodes(
    documentStatus: 'Unknown' | 'Ready' | 'Missing',
    markdownStatus: 'Ready' | 'Missing',
    figmaConnection?: TaskFigmaConnection,
    jiraConnection?: TaskJiraConnection
  ): TaskProcessNode[] {
    return [
      { id: 'document', label: 'Document', status: documentStatus },
      { id: 'figma', label: 'Figma', status: figmaConnection ? 'Sync' : 'Un-sync' },
      { id: 'jira', label: 'Jira', status: jiraConnection?.ticket ? 'Sync' : 'Un-sync' },
      { id: 'markdown', label: 'Markdown', status: markdownStatus },
      { id: 'code', label: 'Code', status: 'Unknown' },
      { id: 'testcase', label: 'Testcase', status: 'Unknown' }
    ];
  }

  private getMarkdownStatus(
    hasDocuments: boolean,
    item?: TaskManagerItem,
    figmaConnection?: TaskFigmaConnection,
    jiraConnection?: TaskJiraConnection
  ): 'Ready' | 'Missing' {
    if (item && (this.taskMarkdownContentByItem[this.getTaskItemKey(item)]?.trim() || item.hasMarkdown)) {
      return 'Ready';
    }

    const hasFigmaSelection = (figmaConnection?.selectedNodeIds || []).length > 0;
    return hasDocuments || hasFigmaSelection || Boolean(jiraConnection?.ticket) ? 'Ready' : 'Missing';
  }

  private async generateTaskMarkdown(mode: TaskManagerMode, item: TaskManagerItem): Promise<string> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();
    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'))
      : undefined;
    const documents = workspaceFolder && documentsFolderUri
      ? await this.listMarkdownDocuments(workspaceFolder, documentsFolderUri)
      : [];
    const documentSummaries = workspaceFolder
      ? await this.getTaskMarkdownDocumentSummaries(workspaceFolder, documents)
      : [];
    const figmaConnection = workspaceFolder ? await this.readFigmaConnection(workspaceFolder, item) : undefined;
    const jiraConnection = workspaceFolder ? await this.readJiraConnection(workspaceFolder, item) : undefined;
    const figmaNodes = this.getSelectedFigmaNodes(figmaConnection);
    const ticket = jiraConnection?.ticket;
    const guide = await this.getTaskMarkdownGuide();

    return this.fillTaskMarkdownGuide(
      guide,
      mode,
      item,
      documentSummaries,
      documentsFolder,
      figmaConnection,
      figmaNodes,
      ticket
    );
  }

  private async getTaskMarkdownGuide(): Promise<string> {
    const candidates = this.extensionUri
      ? [
        path.join(this.extensionUri.fsPath, 'src', ...TASK_MARKDOWN_GUIDE_RELATIVE_PATH),
        path.join(this.extensionUri.fsPath, 'dist', ...TASK_MARKDOWN_BUNDLED_GUIDE_RELATIVE_PATH),
        path.join(this.extensionUri.fsPath, ...TASK_MARKDOWN_BUNDLED_GUIDE_RELATIVE_PATH)
      ]
      : [];

    for (const candidate of candidates) {
      try {
        return await fs.readFile(candidate, 'utf8');
      } catch {
        // Try the next extension layout.
      }
    }

    return [
      '# Task Markdown Brief',
      '',
      '## Objective',
      '- Use this condensed context to implement the task in the codebase.',
      'Keep implementation decisions aligned with imported documents, selected Figma screens, and Jira content.',
      '',
      '## Imported Documents',
      '[Listing all file imported in here]',
      '',
      '## Figma Screens To Match',
      '[Listing all Figma file node selected in here]',
      '',
      '## Jira Context',
      '[Listing Jira content (title, description, comments) in here]',
      '',
      '## Coding Guidance For The AI Agent',
      '- Treat the imported documents as the source of truth for requirements and constraints.',
      '- Match the selected Figma screens when changing UI or user flows.',
      '- Use Jira title, description, and comments to resolve acceptance details and edge cases.',
      '- Keep the change scoped to the task or bug described here.',
      '- Verify behavior with the most relevant build, lint, or manual checks available in this repository.'
    ].join('\n');
  }

  private fillTaskMarkdownGuide(
    guide: string,
    mode: TaskManagerMode,
    item: TaskManagerItem,
    documentSummaries: Array<{ document: TaskDocument; summary: string }>,
    documentsFolder: string,
    figmaConnection: TaskFigmaConnection | undefined,
    figmaNodes: TaskFigmaNode[],
    ticket?: TaskJiraTicket
  ): string {
    const objective = mode === 'fix-bug'
      ? '- Use this condensed context to diagnose and fix the bug in the codebase.'
      : '- Use this condensed context to implement the task in the codebase.';
    const content = guide
      .replace(/\r/g, '')
      .replace('- Use this condensed context to implement the task in the codebase.', objective)
      .replace('[Listing all file imported in here]', this.formatTaskMarkdownDocumentItems(documentSummaries, documentsFolder))
      .replace('[Listing all Figma file node selected in here]', this.formatTaskMarkdownFigmaItems(figmaConnection, figmaNodes))
      .replace('[Listing Jira content (title, description, comments) in here]', this.formatTaskMarkdownJiraItems(ticket))
      .trim();

    return [
      `Task item: ${this.getTaskItemTypeLabel(item.type)} ${item.id}`,
      `Item folder: ${item.folderPath}`,
      `Markdown cache: ${item.markdownPath}`,
      '',
      content
    ].join('\n');
  }

  private async getTaskMarkdownDocumentSummaries(
    workspaceFolder: vscode.Uri,
    documents: TaskDocument[]
  ): Promise<Array<{ document: TaskDocument; summary: string }>> {
    const limitedDocuments = documents.slice(0, TASK_MARKDOWN_DOCUMENT_LIMIT);
    const summaries: Array<{ document: TaskDocument; summary: string }> = [];

    for (const document of limitedDocuments) {
      try {
        const documentUri = vscode.Uri.joinPath(workspaceFolder, ...document.workspacePath.split(/[\\/]+/).filter(Boolean));
        const content = Buffer.from(await vscode.workspace.fs.readFile(documentUri)).toString('utf8');
        summaries.push({
          document,
          summary: this.condenseTaskMarkdownText(content, TASK_MARKDOWN_DOCUMENT_CHAR_LIMIT)
        });
      } catch (error) {
        logger.warn(`Unable to read task markdown document ${document.workspacePath}: ${(error as Error).message}`);
        summaries.push({
          document,
          summary: 'Could not read this document. Open it from the Document step if more context is needed.'
        });
      }
    }

    return summaries;
  }

  private formatTaskMarkdownDocuments(
    documentSummaries: Array<{ document: TaskDocument; summary: string }>,
    documentsFolder: string
  ): string {
    if (documentSummaries.length === 0) {
      return [
        '## Imported Documents',
        `No imported markdown documents were found in ${documentsFolder}.`
      ].join('\n');
    }

    return [
      '## Imported Documents',
      ...documentSummaries.map(({ document, summary }, index) => [
        `### ${index + 1}. ${document.name}`,
        `Path: ${document.workspacePath}`,
        summary
      ].join('\n'))
    ].join('\n\n');
  }

  private formatTaskMarkdownDocumentItems(
    documentSummaries: Array<{ document: TaskDocument; summary: string }>,
    documentsFolder: string
  ): string {
    if (documentSummaries.length === 0) {
      return `No imported markdown documents were found in ${documentsFolder}.`;
    }

    return documentSummaries.map(({ document, summary }, index) => [
      `${index + 1}. ${document.name}`,
      `   - Path: ${document.workspacePath}`,
      `   - Condensed content: ${summary.replace(/\n/g, '\n     ')}`
    ].join('\n')).join('\n\n');
  }

  private getSelectedFigmaNodes(figmaConnection?: TaskFigmaConnection): TaskFigmaNode[] {
    if (!figmaConnection) {
      return [];
    }

    const selectedNodeIds = new Set(figmaConnection.selectedNodeIds || []);
    return figmaConnection.nodes.filter(node => selectedNodeIds.has(node.id));
  }

  private formatTaskMarkdownFigma(nodes: TaskFigmaNode[]): string {
    if (!this.figmaConnection) {
      return [
        '## Figma Screens To Match',
        'No Figma file is synced.'
      ].join('\n');
    }

    if (nodes.length === 0) {
      return [
        '## Figma Screens To Match',
        `File: ${this.figmaConnection.fileName}`,
        'No Figma nodes are selected for this task or bug.'
      ].join('\n');
    }

    return [
      '## Figma Screens To Match',
      `File: ${this.figmaConnection.fileName}`,
      ...nodes.map((node, index) => [
        `${index + 1}. ${node.name}`,
        `   - Type: ${node.type}`,
        `   - Node ID: ${node.id}`,
        `   - Path: ${node.path}`
      ].join('\n'))
    ].join('\n');
  }

  private formatTaskMarkdownFigmaItems(figmaConnection: TaskFigmaConnection | undefined, nodes: TaskFigmaNode[]): string {
    if (!figmaConnection) {
      return 'No Figma file is synced.';
    }

    if (nodes.length === 0) {
      return [
        `File: ${figmaConnection.fileName}`,
        'No Figma nodes are selected for this task or bug.'
      ].join('\n');
    }

    return [
      `File: ${figmaConnection.fileName}`,
      ...nodes.map((node, index) => [
        `${index + 1}. ${node.name}`,
        `   - Type: ${node.type}`,
        `   - Node ID: ${node.id}`,
        `   - Path: ${node.path}`
      ].join('\n'))
    ].join('\n');
  }

  private formatTaskMarkdownJira(ticket?: TaskJiraTicket): string {
    if (!ticket) {
      return [
        '## Jira Context',
        'No Jira ticket has been read yet.'
      ].join('\n');
    }

    const lines = [
      '## Jira Context',
      `Title: ${ticket.title}`,
      ticket.key ? `Key: ${ticket.key}` : undefined,
      `URL: ${ticket.url}`,
      '',
      this.condenseTaskMarkdownText(ticket.content, TASK_MARKDOWN_DOCUMENT_CHAR_LIMIT)
    ].filter((line): line is string => line !== undefined);

    return lines.join('\n');
  }

  private formatTaskMarkdownJiraItems(ticket?: TaskJiraTicket): string {
    if (!ticket) {
      return 'No Jira ticket has been read yet.';
    }

    return [
      '### Ticket',
      ticket.key ? `- Key: ${ticket.key}` : undefined,
      `- URL: ${ticket.url}`,
      `- Read: ${ticket.lastReadAt}`,
      '',
      '### Title',
      ticket.title,
      '',
      '### Description',
      ticket.description || 'No description collected.',
      '',
      '### Comments',
      this.formatJiraCommentMarkdown(ticket.comments, 4)
    ].filter((line): line is string => line !== undefined).join('\n');
  }

  private condenseTaskMarkdownText(value: string, maxLength: number): string {
    const lines = value
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const importantLines = lines.filter((line, index) => {
      return index < 18 ||
        /^#{1,4}\s+/.test(line) ||
        /^[-*]\s+/.test(line) ||
        /^\d+\.\s+/.test(line);
    });
    const condensed = importantLines.join('\n').slice(0, maxLength).trim();

    if (!condensed) {
      return 'No readable text was found.';
    }

    return value.length > maxLength ? `${condensed}\n...` : condensed;
  }

  private parseFigmaLink(link: string): ParsedFigmaLink {
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

  private async fetchFigmaFile(figmaLink: ParsedFigmaLink, token: string): Promise<FigmaApiResponse> {
    const fileKey = encodeURIComponent(figmaLink.fileKey);
    const requestPath = `/v1/files/${fileKey}`;

    return this.requestFigmaApi(requestPath, token);
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

  private getFigmaNodes(response: FigmaApiResponse): TaskFigmaNode[] {
    if (!response.document) {
      return [];
    }

    const nodes: TaskFigmaNode[] = [];
    this.collectFigmaNodes(response.document, [], 0, nodes);
    return nodes;
  }

  private getInitialFigmaSelectedNodeIds(nodes: TaskFigmaNode[], figmaLink: ParsedFigmaLink): string[] {
    const availableNodeIds = new Set(nodes.map(node => node.id));
    const previousSelection = this.figmaConnection?.fileKey === figmaLink.fileKey
      ? this.figmaConnection.selectedNodeIds || []
      : [];

    return this.getUniqueFigmaNodeIds([
      ...(figmaLink.nodeId ? [figmaLink.nodeId] : []),
      ...previousSelection
    ]).filter(nodeId => availableNodeIds.has(nodeId));
  }

  private getUniqueFigmaNodeIds(nodeIds: string[]): string[] {
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

  private ensureRequestedFigmaNodeExists(response: FigmaApiResponse, nodeId?: string): void {
    if (!nodeId) {
      return;
    }

    if (!response.document || !this.findFigmaNode(response.document, nodeId)) {
      throw new Error(`Figma node ${nodeId} was not found in this file.`);
    }
  }

  private getFigmaNodeName(response: FigmaApiResponse, nodeId?: string): string | undefined {
    if (!nodeId) {
      return undefined;
    }

    return response.document ? this.findFigmaNode(response.document, nodeId)?.name : undefined;
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

  private parseJiraLink(link: string): string {
    const trimmedLink = link.trim();

    if (!trimmedLink) {
      throw new Error('Paste a Jira ticket URL before opening Chrome.');
    }

    let url: URL;
    try {
      url = new URL(trimmedLink);
    } catch {
      throw new Error('Paste a valid Jira ticket URL.');
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Paste a valid Jira ticket URL.');
    }

    return url.toString();
  }

  private async openJiraPage(link: string): Promise<{ page: Page; profilePath: string }> {
    const profilePath = await this.getJiraProfilePath();
    await fs.mkdir(profilePath, { recursive: true });

    const context = await this.getOrCreateJiraBrowserContext(profilePath);
    const page = await this.getOrCreateJiraPage(context);

    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: JIRA_PAGE_TIMEOUT_MS });
    await page.bringToFront().catch(() => undefined);

    return { page, profilePath };
  }

  private async getOrCreateJiraBrowserContext(profilePath: string): Promise<BrowserContext> {
    if (this.jiraBrowserContext) {
      return this.jiraBrowserContext;
    }

    const playwright = await this.loadPlaywright();
    const launchOptions = {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: ['--start-maximized']
    };

    try {
      this.jiraBrowserContext = await playwright.chromium.launchPersistentContext(profilePath, launchOptions);
    } catch (error) {
      if (!this.shouldInstallPlaywrightChrome(error as Error)) {
        throw this.getJiraBrowserLaunchError(error as Error);
      }

      await this.installPlaywrightChrome();
      this.jiraBrowserContext = await playwright.chromium.launchPersistentContext(profilePath, launchOptions);
    }

    this.jiraBrowserContext.on('close', () => {
      this.jiraBrowserContext = undefined;
      this.jiraPage = undefined;
    });

    return this.jiraBrowserContext;
  }

  private async getOrCreateJiraPage(context: BrowserContext): Promise<Page> {
    if (this.jiraPage && !this.jiraPage.isClosed()) {
      return this.jiraPage;
    }

    const pages = context.pages().filter(page => !page.isClosed());
    this.jiraPage = pages[0] || await context.newPage();
    return this.jiraPage;
  }

  private async closeJiraBrowser(): Promise<void> {
    const context = this.jiraBrowserContext;
    this.jiraBrowserContext = undefined;
    this.jiraPage = undefined;

    if (!context) {
      return;
    }

    try {
      await Promise.all(context.pages().map(async page => {
        if (!page.isClosed()) {
          await page.close({ runBeforeUnload: false });
        }
      }));
      await context.close();
    } catch (error) {
      const message = (error as Error).message;
      if (this.isPlaywrightAlreadyClosedError(message)) {
        return;
      }

      logger.error('Unable to close Playwright Chrome after Jira read', error as Error);
      throw new Error(`Read Jira ticket, but unable to close Playwright Chrome: ${message}`);
    }
  }

  private isPlaywrightAlreadyClosedError(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('has been closed') ||
      normalizedMessage.includes('target page, context or browser has been closed') ||
      normalizedMessage.includes('browser has been closed');
  }

  private async getJiraProfilePath(): Promise<string> {
    if (!this.storageUri) {
      throw new Error('Extension storage is not available for the Jira browser profile.');
    }

    await vscode.workspace.fs.createDirectory(this.storageUri);
    return path.join(this.storageUri.fsPath, JIRA_BROWSER_PROFILE_FOLDER);
  }

  private async loadPlaywright(): Promise<typeof import('playwright')> {
    try {
      return await import('playwright');
    } catch (error) {
      logger.error('Playwright dependency is missing', error as Error);
      throw new Error('Playwright is not installed. Run npm install, then try Jira again.');
    }
  }

  private shouldInstallPlaywrightChrome(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('executable doesn') ||
      message.includes('please run') ||
      message.includes('install chrome') ||
      message.includes('chromium distribution') ||
      message.includes('not found');
  }

  private async installPlaywrightChrome(): Promise<void> {
    let cliPath: string;

    try {
      const requireFunc = createRequire(__filename);
      cliPath = requireFunc.resolve('playwright/cli');
    } catch (error) {
      logger.error('Unable to find Playwright CLI', error as Error);
      throw new Error('Playwright CLI was not found. Run npm install, then try Jira again.');
    }

    try {
      logger.info('Installing Playwright Chrome for Jira integration');
      await execFileAsync(process.execPath, [cliPath, 'install', 'chrome'], {
        windowsHide: true,
        maxBuffer: MARKITDOWN_MAX_BUFFER
      });
    } catch (error) {
      logger.error('Unable to install Playwright Chrome', error as Error);
      throw new Error(
        `Unable to install Playwright Chrome. Run npx playwright install chrome, then try again. ${this.getExecErrorText(error as Error)}`
      );
    }
  }

  private getJiraBrowserLaunchError(error: Error): Error {
    logger.error('Unable to launch Playwright Chrome for Jira', error);
    return new Error(`Unable to open Playwright Chrome for Jira. ${error.message}`);
  }

  private async extractJiraTicket(page: Page, requestedLink: string): Promise<TaskJiraTicket> {
    const data = await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as { document: any; window: any };
      const document = browserGlobal.document;
      const window = browserGlobal.window;
      const normalize = (value: string | undefined | null): string => String(value || '')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

      const uniqueTexts = (values: string[]): string[] => {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const value of values) {
          const text = normalize(value);
          const key = text.toLowerCase();

          if (text && !seen.has(key)) {
            seen.add(key);
            result.push(text);
          }
        }

        return result;
      };

      const getElements = (selectors: string[]): any[] => {
        const elements: any[] = [];

        for (const selector of selectors) {
          try {
            elements.push(...Array.from(document.querySelectorAll(selector)));
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return elements;
      };

      const getCleanText = (element: any): string => {
        if (!element) {
          return '';
        }

        const clone = element.cloneNode(true);
        const removableSelectors = [
          'script',
          'style',
          'svg',
          'button',
          'input',
          'textarea',
          'select',
          '[role="button"]',
          '[aria-hidden="true"]',
          '[data-testid*="actions"]',
          '[data-test-id*="actions"]',
          '[data-testid*="toolbar"]',
          '[data-test-id*="toolbar"]'
        ];

        for (const selector of removableSelectors) {
          try {
            for (const node of Array.from(clone.querySelectorAll(selector)) as any[]) {
              node.remove();
            }
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return normalize(clone.textContent || '');
      };

      const getText = (selectors: string[]): string => {
        for (const element of getElements(selectors)) {
          const text = getCleanText(element);

          if (text) {
            return text;
          }
        }

        return '';
      };

      const stripLeadingLabel = (value: string, label: string): string => {
        const text = normalize(value);
        const lowerText = text.toLowerCase();
        const lowerLabel = label.toLowerCase();

        if (lowerText === lowerLabel) {
          return '';
        }

        if (lowerText.startsWith(`${lowerLabel}\n`) || lowerText.startsWith(`${lowerLabel}:`)) {
          return normalize(text.slice(label.length).replace(/^[:\s]+/, ''));
        }

        return text;
      };

      const getFirstDescendantText = (element: any, selectors: string[]): string => {
        for (const selector of selectors) {
          try {
            const child = element.querySelector(selector);
            const text = getCleanText(child);

            if (text) {
              return text;
            }
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return '';
      };

      const getCommentTexts = (): string[] => {
        const commentBodySelectors = [
          '[data-testid*="comment.body"]',
          '[data-test-id*="comment.body"]',
          '[data-testid*="comment-content"]',
          '[data-test-id*="comment-content"]',
          '.ak-renderer-document',
          '.action-body',
          '.comment-body',
          '.wiki-content',
          '.user-content-block'
        ];
        const rawComments = getElements([
          '[data-testid="issue.activity.comment"]',
          '[data-test-id="issue.activity.comment"]',
          '[data-testid*="activity.comment"]',
          '[data-test-id*="activity.comment"]',
          '[data-testid^="issue-comment"]',
          '[data-test-id^="issue-comment"]',
          '[data-testid*="comment-container"]',
          '[data-test-id*="comment-container"]',
          '#commentmodule .activity-comment',
          '#commentmodule [id^="comment-"]',
          '#issue_actions_container .activity-comment',
          '.issue-data-block.activity-comment',
          '.activity-comment'
        ]).map((element) => {
          return getFirstDescendantText(element, commentBodySelectors) || getCleanText(element);
        });
        const ignoredText = new Set([
          'add a comment',
          'add a comment...',
          'comment',
          'comments'
        ]);

        return uniqueTexts(rawComments).filter((comment) => !ignoredText.has(comment.toLowerCase()));
      };

      const key = getText([
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-testid*="current-issue"]',
        '[data-test-id*="current-issue"]',
        'a[href*="/browse/"]',
        '#key-val'
      ]);
      const summary = getText([
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
        '[data-testid*="summary.heading"]',
        '[data-test-id*="summary.heading"]',
        '#summary-val',
        'header h1',
        'h1'
      ]);
      const rawDescription = stripLeadingLabel(getText([
        '[data-testid="issue.views.field.rich-text.description"]',
        '[data-test-id="issue.views.field.rich-text.description"]',
        '[data-testid*="rich-text.description"]',
        '[data-test-id*="rich-text.description"]',
        '[data-testid*="description.field-inline-edit"]',
        '[data-test-id*="description.field-inline-edit"]',
        '[data-testid*="description"] .ak-renderer-document',
        '[data-test-id*="description"] .ak-renderer-document',
        '[data-field-id="description"]',
        '[aria-label="Description"]',
        '#description-val',
        '#descriptionmodule .user-content-block',
        '.description .user-content-block'
      ]), 'Description');
      const ignoredDescriptionText = new Set([
        'add a description',
        'add a description...',
        'no description'
      ]);
      const description = ignoredDescriptionText.has(rawDescription.toLowerCase()) ? '' : rawDescription;
      const comments = getCommentTexts();

      return {
        url: window.location.href,
        title: normalize(document.title),
        key,
        summary,
        description,
        comments
      };
    });
    const summary = data.summary.trim();
    const description = data.description.trim();
    const comments = data.comments
      .map((comment: string) => comment.trim())
      .filter(Boolean);

    if (!summary && !description && comments.length === 0) {
      throw new Error('No Jira title, description, or comments were found on the current page.');
    }

    const key = this.normalizeJiraIssueKey(data.key) ||
      this.getJiraIssueKeyFromUrl(data.url) ||
      this.getJiraIssueKeyFromUrl(requestedLink) ||
      this.getJiraIssueKeyFromText([summary, description, comments.join('\n')].join('\n'));
    const title = summary || data.title.trim() || key || data.url;
    const content = this.formatJiraTicketContent(title, description, comments);

    return {
      url: data.url,
      title,
      key,
      description: description || undefined,
      comments,
      content,
      lastReadAt: new Date().toISOString()
    };
  }

  private formatJiraTicketContent(title: string, description: string, comments: string[]): string {
    return [
      `# Jira: ${title.trim()}`,
      '',
      '## Description',
      description.trim() || 'No description collected.',
      '',
      '## Comments',
      this.formatJiraCommentMarkdown(comments, 3)
    ].join('\n').trim();
  }

  private isJiraLoginPage(urlValue: string): boolean {
    try {
      const url = new URL(urlValue);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();

      return hostname === 'id.atlassian.com' ||
        hostname.endsWith('.id.atlassian.com') ||
        pathname.includes('/login') ||
        pathname.includes('/secure/login');
    } catch {
      return false;
    }
  }

  private normalizeJiraIssueKey(value: string): string | undefined {
    const match = value.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
    return match ? match[1].toUpperCase() : undefined;
  }

  private getJiraIssueKeyFromUrl(value: string): string | undefined {
    try {
      const url = new URL(value);
      const browseMatch = url.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
      const selectedIssue = url.searchParams.get('selectedIssue');

      return this.normalizeJiraIssueKey(browseMatch?.[1] || selectedIssue || '');
    } catch {
      return undefined;
    }
  }

  private getJiraIssueKeyFromText(value: string): string | undefined {
    return this.normalizeJiraIssueKey(value);
  }

  private getExecErrorText(error: Error): string {
    const execError = error as Error & {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    const detail = execError.stderr?.toString().trim() ||
      execError.stdout?.toString().trim() ||
      execError.message;

    return detail.replace(/\s+/g, ' ').slice(0, 500);
  }

  private resolveStateItem(
    items: TaskManagerItem[],
    mode: TaskManagerMode,
    itemReference?: { itemId?: string; itemType?: TaskItemType }
  ): TaskManagerItem | undefined {
    const hasExplicitReference = Boolean(itemReference);
    const itemId = hasExplicitReference ? itemReference?.itemId : this.currentItem?.id;
    const itemType = hasExplicitReference
      ? itemReference?.itemType || getTaskItemTypeForMode(mode)
      : this.currentItem?.type || getTaskItemTypeForMode(mode);

    if (!itemId) {
      return undefined;
    }

    return items.find(item => item.id === itemId && item.type === itemType);
  }

  private async requireWorkspaceFolder(): Promise<vscode.Uri> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    return workspaceFolder;
  }

  private async resolveOperationItem(
    workspaceFolder: vscode.Uri | undefined,
    mode: TaskManagerMode,
    itemReference?: { itemId?: string; itemType?: TaskItemType }
  ): Promise<TaskManagerItem> {
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const itemId = itemReference?.itemId || this.currentItem?.id;
    const itemType = itemReference?.itemType || this.currentItem?.type || getTaskItemTypeForMode(mode);

    if (!itemId) {
      throw new Error('Create or select a task or bug item before running this step.');
    }

    const item = await this.getTaskItem(workspaceFolder, itemType, itemId);

    if (!await this.uriExists(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id))) {
      throw new Error(`${this.getTaskItemTypeLabel(item.type)} ${item.id} was not found.`);
    }

    this.currentItem = item;
    return item;
  }

  private async listTaskItems(workspaceFolder: vscode.Uri): Promise<TaskManagerItem[]> {
    const items: TaskManagerItem[] = [];

    for (const type of Object.keys(TASK_ITEM_FOLDERS) as TaskItemType[]) {
      const folderUri = this.getProjectTypeFolderUri(workspaceFolder, type);
      let entries: [string, vscode.FileType][];

      try {
        entries = await vscode.workspace.fs.readDirectory(folderUri);
      } catch {
        continue;
      }

      for (const [name, fileType] of entries) {
        if (fileType !== vscode.FileType.Directory) {
          continue;
        }

        try {
          items.push(await this.getTaskItem(workspaceFolder, type, name));
        } catch (error) {
          logger.warn(`Skipping invalid task manager item ${name}: ${(error as Error).message}`);
        }
      }
    }

    return items.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      return typeCompare !== 0 ? typeCompare : a.id.localeCompare(b.id);
    });
  }

  private async getTaskItem(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<TaskManagerItem> {
    const itemType = this.normalizeTaskItemType(type);
    const itemId = this.normalizeTaskItemId(id);
    const folderUri = this.getTaskItemFolderUri(workspaceFolder, itemType, itemId);
    await this.migrateLegacyTaskMarkdown(workspaceFolder, itemType, itemId);
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, itemType, itemId);
    const jiraUri = this.getTaskItemJiraUri(workspaceFolder, itemType, itemId);
    const figmaCacheUri = this.getFigmaCacheUri(workspaceFolder, itemType, itemId);
    const folderStat = await this.statUri(folderUri);
    const markdownStat = await this.statUri(markdownUri);
    const jiraStat = await this.statUri(jiraUri);
    const figmaStat = await this.statUri(figmaCacheUri);
    const updatedAt = this.getLatestStatDate([folderStat, markdownStat, jiraStat, figmaStat]);

    return {
      id: itemId,
      type: itemType,
      folderPath: this.getTaskItemFolderRelativePath(itemType, itemId),
      markdownPath: this.getTaskItemMarkdownRelativePath(itemType, itemId),
      jiraPath: this.getTaskItemJiraRelativePath(itemType, itemId),
      figmaCachePath: this.getFigmaCacheRelativePath(itemType, itemId),
      createdAt: folderStat ? new Date(folderStat.ctime).toISOString() : undefined,
      updatedAt: updatedAt ? updatedAt.toISOString() : undefined,
      hasJira: Boolean(jiraStat),
      hasMarkdown: Boolean(markdownStat),
      hasFigmaCache: Boolean(figmaStat)
    };
  }

  private getLatestStatDate(stats: Array<vscode.FileStat | undefined>): Date | undefined {
    const timestamps = stats
      .map(stat => stat?.mtime)
      .filter((value): value is number => typeof value === 'number' && value > 0);

    if (timestamps.length === 0) {
      return undefined;
    }

    return new Date(Math.max(...timestamps));
  }

  private async migrateLegacyTaskMarkdown(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<void> {
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, type, id);

    if (await this.uriExists(markdownUri)) {
      return;
    }

    const legacyMarkdownUri = this.getLegacyTaskItemMarkdownUri(workspaceFolder, type, id);

    if (!await this.uriExists(legacyMarkdownUri)) {
      return;
    }

    try {
      await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, type, id));
      await vscode.workspace.fs.rename(legacyMarkdownUri, markdownUri, { overwrite: false });
    } catch (error) {
      logger.warn(`Unable to move legacy task markdown ${this.getLegacyTaskItemMarkdownRelativePath(type, id)}: ${(error as Error).message}`);
    }
  }

  private async readTaskMarkdown(workspaceFolder: vscode.Uri, item: TaskManagerItem): Promise<string | undefined> {
    await this.migrateLegacyTaskMarkdown(workspaceFolder, item.type, item.id);
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id);

    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(markdownUri)).toString('utf8');
      this.taskMarkdownContentByItem[this.getTaskItemKey(item)] = content;
      return content;
    } catch {
      return undefined;
    }
  }

  private async writeTaskMarkdown(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem,
    content: string
  ): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id));
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id);
    await vscode.workspace.fs.writeFile(markdownUri, Buffer.from(content.endsWith('\n') ? content : `${content}\n`, 'utf8'));
  }

  private async ensureTaskMarkdownExists(workspaceFolder: vscode.Uri, item: TaskManagerItem): Promise<void> {
    const itemKey = this.getTaskItemKey(item);
    const existingContent = this.taskMarkdownContentByItem[itemKey] || await this.readTaskMarkdown(workspaceFolder, item);

    if (existingContent?.trim()) {
      return;
    }

    const generatedAt = new Date().toISOString();
    const content = await this.generateTaskMarkdown(TASK_TYPE_TO_MODE[item.type], item);
    this.taskMarkdownContentByItem[itemKey] = content;
    this.taskMarkdownUpdatedAtByItem[itemKey] = generatedAt;
    await this.writeTaskMarkdown(workspaceFolder, item, content);
  }

  private async getTaskMarkdownUpdatedAt(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem
  ): Promise<string | undefined> {
    await this.migrateLegacyTaskMarkdown(workspaceFolder, item.type, item.id);
    const stat = await this.statUri(this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id));
    return stat ? new Date(stat.mtime).toISOString() : undefined;
  }

  private async readFigmaConnection(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem
  ): Promise<TaskFigmaConnection | undefined> {
    try {
      const cacheUri = this.getFigmaCacheUri(workspaceFolder, item.type, item.id);
      const payload = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(cacheUri)).toString('utf8'));
      const connection = payload.connection as TaskFigmaConnection | undefined;

      if (!connection?.link || !connection.fileKey || !connection.fileName) {
        return undefined;
      }

      return {
        ...connection,
        nodes: Array.isArray(connection.nodes) ? connection.nodes : [],
        selectedNodeIds: Array.isArray(connection.selectedNodeIds) ? connection.selectedNodeIds : []
      };
    } catch {
      return undefined;
    }
  }

  private async writeFigmaConnection(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem,
    connection: TaskFigmaConnection
  ): Promise<void> {
    const figmaFolderUri = vscode.Uri.joinPath(workspaceFolder, ...PROJECT_FIGMA_FOLDER.split('/'));
    await vscode.workspace.fs.createDirectory(figmaFolderUri);
    const cacheUri = this.getFigmaCacheUri(workspaceFolder, item.type, item.id);
    const payload = {
      schemaVersion: FIGMA_CACHE_SCHEMA_VERSION,
      itemId: item.id,
      itemType: item.type,
      cachedAt: new Date().toISOString(),
      connection
    };

    await vscode.workspace.fs.writeFile(cacheUri, Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8'));
  }

  private async readJiraConnection(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem
  ): Promise<TaskJiraConnection | undefined> {
    const jiraUri = this.getTaskItemJiraUri(workspaceFolder, item.type, item.id);

    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(jiraUri)).toString('utf8');
      const stat = await this.statUri(jiraUri);
      const ticket = this.parseJiraTicketMarkdown(content, stat?.mtime);

      if (!ticket) {
        return undefined;
      }

      return {
        link: ticket.url,
        profilePath: this.getJiraProfilePathValue(),
        lastReadAt: ticket.lastReadAt,
        ticket
      };
    } catch {
      return undefined;
    }
  }

  private async writeJiraConnection(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem,
    connection: TaskJiraConnection
  ): Promise<void> {
    if (!connection.ticket) {
      return;
    }

    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id));
    const jiraUri = this.getTaskItemJiraUri(workspaceFolder, item.type, item.id);
    await vscode.workspace.fs.writeFile(jiraUri, Buffer.from(this.formatJiraTicketMarkdown(connection.ticket), 'utf8'));
  }

  private formatJiraTicketMarkdown(ticket: TaskJiraTicket): string {
    const metadata = Buffer.from(JSON.stringify(ticket), 'utf8').toString('base64');
    const lines = [
      `<!-- ${JIRA_CACHE_PREFIX}${metadata} -->`,
      `# Jira: ${ticket.title}`,
      '',
      '## Ticket',
      ticket.key ? `- Key: ${ticket.key}` : undefined,
      `- URL: ${ticket.url}`,
      `- Read: ${ticket.lastReadAt}`,
      '',
      '## Title',
      ticket.title,
      '',
      '## Description',
      ticket.description || 'No description collected.',
      '',
      '## Comments',
      this.formatJiraCommentMarkdown(ticket.comments, 3),
      ''
    ].filter((line): line is string => line !== undefined);

    return lines.join('\n');
  }

  private formatJiraCommentMarkdown(comments: string[], headingLevel: number): string {
    const normalizedComments = comments
      .map(comment => comment.trim())
      .filter(Boolean);

    if (normalizedComments.length === 0) {
      return 'No comments collected.';
    }

    const heading = '#'.repeat(headingLevel);
    return normalizedComments
      .map((comment, index) => [`${heading} Comment ${index + 1}`, comment].join('\n'))
      .join('\n\n');
  }

  private parseJiraTicketMarkdown(content: string, mtime?: number): TaskJiraTicket | undefined {
    const metadataMatch = content.match(/<!--\s*agentkit:jira:([A-Za-z0-9+/=]+)\s*-->/);

    if (metadataMatch) {
      try {
        const ticket = JSON.parse(Buffer.from(metadataMatch[1], 'base64').toString('utf8')) as TaskJiraTicket;
        return {
          ...ticket,
          comments: Array.isArray(ticket.comments) ? ticket.comments : [],
          content: ticket.content || content,
          lastReadAt: ticket.lastReadAt || new Date(mtime || Date.now()).toISOString()
        };
      } catch {
        // Fall through to the lightweight markdown parser.
      }
    }

    const title = content.match(/^# Jira:\s*(.+)$/m)?.[1]?.trim() ||
      content.match(/^## Title\s+([\s\S]*?)(?:\n## |\s*$)/m)?.[1]?.trim();

    if (!title) {
      return undefined;
    }

    const url = content.match(/^URL:\s*(.+)$/m)?.[1]?.trim() || '';
    const key = content.match(/^Key:\s*(.+)$/m)?.[1]?.trim();
    const description = content.match(/^## Description\s+([\s\S]*?)(?:\n## |\s*$)/m)?.[1]?.trim();

    return {
      url,
      title,
      key,
      description,
      comments: [],
      content,
      lastReadAt: new Date(mtime || Date.now()).toISOString()
    };
  }

  private getJiraProfilePathValue(): string {
    return this.storageUri ? path.join(this.storageUri.fsPath, JIRA_BROWSER_PROFILE_FOLDER) : '';
  }

  private normalizeTaskItemType(type: TaskItemType): TaskItemType {
    if (type === 'task' || type === 'bug') {
      return type;
    }

    throw new Error('Choose either task or bug.');
  }

  private normalizeTaskItemId(id: string): string {
    const trimmedId = String(id || '').trim();

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(trimmedId) || trimmedId === '.' || trimmedId === '..') {
      throw new Error('Use a task or bug ID with letters, numbers, dots, underscores, or dashes only.');
    }

    return trimmedId;
  }

  private getTaskItemKey(item: TaskManagerItem): string {
    return `${item.type}:${item.id}`;
  }

  private getTaskItemTypeLabel(type: TaskItemType): string {
    return type === 'bug' ? 'Bug' : 'Task';
  }

  private getProjectTypeFolderUri(workspaceFolder: vscode.Uri, type: TaskItemType): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, PROJECT_FOLDER, TASK_ITEM_FOLDERS[type]);
  }

  private getTaskItemFolderUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getTaskItemFolderRelativePath(type, id).split('/'));
  }

  private getTaskItemMarkdownUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getTaskItemMarkdownRelativePath(type, id).split('/'));
  }

  private getLegacyTaskItemMarkdownUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getLegacyTaskItemMarkdownRelativePath(type, id).split('/'));
  }

  private getTaskItemJiraUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getTaskItemJiraRelativePath(type, id).split('/'));
  }

  private getFigmaCacheUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getFigmaCacheRelativePath(type, id).split('/'));
  }

  private getTaskItemFolderRelativePath(type: TaskItemType, id: string): string {
    return `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS[type]}/${id}`;
  }

  private getTaskItemMarkdownRelativePath(type: TaskItemType, id: string): string {
    return `${this.getTaskItemFolderRelativePath(type, id)}/${id}.md`;
  }

  private getLegacyTaskItemMarkdownRelativePath(type: TaskItemType, id: string): string {
    return `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS[type]}/${id}.md`;
  }

  private getTaskItemJiraRelativePath(type: TaskItemType, id: string): string {
    return `${this.getTaskItemFolderRelativePath(type, id)}/${JIRA_MARKDOWN_FILE_NAME}`;
  }

  private getFigmaCacheRelativePath(type: TaskItemType, id: string): string {
    return `${PROJECT_FIGMA_FOLDER}/${type}-${id}.json`;
  }

  private async statUri(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
    try {
      return await vscode.workspace.fs.stat(uri);
    } catch {
      return undefined;
    }
  }

  private async uriExists(uri: vscode.Uri): Promise<boolean> {
    return Boolean(await this.statUri(uri));
  }

  private async deleteUriIfExists(
    uri: vscode.Uri,
    options: { recursive: boolean; useTrash: boolean }
  ): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, options);
    } catch {
      // Missing cache files are fine during task item deletion.
    }
  }

  private getDocumentsRelativeFolder(): string {
    const configuredFolder = this.configService.getTaskDocumentsFolder().trim();
    const folder = configuredFolder || DEFAULT_TASK_DOCUMENTS_FOLDER;
    const normalizedFolder = folder.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalizedFolder.split('/').filter(Boolean);

    if (path.isAbsolute(folder) || segments.length === 0 || segments.includes('..')) {
      logger.warn('Invalid task documents folder configured, falling back to default');
      return DEFAULT_TASK_DOCUMENTS_FOLDER;
    }

    return segments.join('/');
  }

  private async listMarkdownDocuments(
    workspaceFolder: vscode.Uri,
    documentsFolderUri: vscode.Uri
  ): Promise<TaskDocument[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(documentsFolderUri);
      return entries
        .filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.md'))
        .map(([name]) => {
          const documentUri = vscode.Uri.joinPath(documentsFolderUri, name);
          return {
            name,
            workspacePath: this.toWorkspacePath(workspaceFolder.fsPath, documentUri.fsPath)
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  private async convertToMarkdown(sourceBuffer: Buffer, safeBaseName: string, extension: string): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentkit-document-'));
    const sourceExtension = extension || '.bin';
    const tempSourcePath = path.join(tempDir, `${safeBaseName}${sourceExtension}`);

    try {
      await fs.writeFile(tempSourcePath, sourceBuffer);
      const markdown = await this.runMarkitdown(tempSourcePath);
      return markdown.endsWith('\n') ? markdown : `${markdown}\n`;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runMarkitdown(sourcePath: string): Promise<string> {
    const candidates = await this.getMarkitdownCandidates(sourcePath);

    let lastErrorMessage = '';

    for (const candidate of candidates) {
      try {
        const result = await execFileAsync(candidate.command, candidate.args, {
          windowsHide: true,
          maxBuffer: MARKITDOWN_MAX_BUFFER
        });

        const markdown = result.stdout.toString();
        if (markdown.trim().length === 0) {
          logger.warn('markitdown returned empty markdown output');
        }

        return markdown;
      } catch (error) {
        lastErrorMessage = this.getExecErrorMessage(candidate, error as Error);
        logger.debug(`markitdown candidate failed: ${candidate.label}`, error as Error);
      }
    }

    throw new Error(
      `Unable to convert document with markitdown. ${this.getMarkitdownInstallHint(sourcePath)} ${lastErrorMessage}`
    );
  }

  private async getMarkitdownCandidates(sourcePath: string): Promise<MarkitdownCandidate[]> {
    const candidates: MarkitdownCandidate[] = [
      { command: 'markitdown', args: [sourcePath], label: 'markitdown' },
      { command: 'python', args: ['-m', 'markitdown', sourcePath], label: 'python -m markitdown' },
      { command: 'python3', args: ['-m', 'markitdown', sourcePath], label: 'python3 -m markitdown' },
      { command: 'py', args: ['-3', '-m', 'markitdown', sourcePath], label: 'py -3 -m markitdown' }
    ];

    if (process.platform === 'win32') {
      const windowsCandidates = await this.getWindowsMarkitdownCandidates(sourcePath);
      candidates.push(...windowsCandidates);
    }

    return this.dedupeCandidates(candidates);
  }

  private async getWindowsMarkitdownCandidates(sourcePath: string): Promise<MarkitdownCandidate[]> {
    const candidates: MarkitdownCandidate[] = [];
    const localAppData = process.env.LOCALAPPDATA;
    const appData = process.env.APPDATA;

    if (localAppData) {
      const pythonRoot = path.join(localAppData, 'Programs', 'Python');
      const markitdownExecutables = await this.findPythonVersionedFiles(pythonRoot, ['Scripts', 'markitdown.exe']);
      const pythonExecutables = await this.findPythonVersionedFiles(pythonRoot, ['python.exe']);

      candidates.push(
        ...markitdownExecutables.map(command => ({
          command,
          args: [sourcePath],
          label: command
        })),
        ...pythonExecutables.map(command => ({
          command,
          args: ['-m', 'markitdown', sourcePath],
          label: `${command} -m markitdown`
        }))
      );
    }

    if (appData) {
      const pythonRoot = path.join(appData, 'Python');
      const markitdownExecutables = await this.findPythonVersionedFiles(pythonRoot, ['Scripts', 'markitdown.exe']);

      candidates.push(
        ...markitdownExecutables.map(command => ({
          command,
          args: [sourcePath],
          label: command
        }))
      );
    }

    return candidates;
  }

  private async findPythonVersionedFiles(rootPath: string, fileSegments: string[]): Promise<string[]> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || !/^Python\d+/i.test(entry.name)) {
          continue;
        }

        const candidatePath = path.join(rootPath, entry.name, ...fileSegments);
        if (await this.pathExists(candidatePath)) {
          files.push(candidatePath);
        }
      }

      return files.sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private dedupeCandidates(candidates: MarkitdownCandidate[]): MarkitdownCandidate[] {
    const seen = new Set<string>();

    return candidates.filter(candidate => {
      const key = `${candidate.command}\0${candidate.args.join('\0')}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private getExecErrorMessage(candidate: MarkitdownCandidate, error: Error): string {
    const execError = error as Error & {
      code?: string | number;
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    const stderr = execError.stderr ? execError.stderr.toString().trim() : '';
    const stdout = execError.stdout ? execError.stdout.toString().trim() : '';
    const details = this.cleanExecErrorDetails(stderr || stdout || execError.message);

    return `Last command: ${candidate.label}. ${details}`;
  }

  private cleanExecErrorDetails(details: string): string {
    const dependencyMatch = details.match(/MissingDependencyException(?: with message)?:\s*([\s\S]*)/);
    const conversionMatch = details.match(/FileConversionException:\s*([\s\S]*)/);
    const cleanedDetails = (dependencyMatch?.[1] || conversionMatch?.[1] || details)
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedDetails.length > 2000
      ? `${cleanedDetails.slice(0, 2000)}...`
      : cleanedDetails;
  }

  private getMarkitdownInstallHint(sourcePath: string): string {
    if (path.extname(sourcePath).toLowerCase() === '.pdf') {
      return 'For PDF files, install the PDF extra with: python -m pip install "markitdown[pdf]".';
    }

    return 'Install markitdown or run NWA: Init env.';
  }

  private async getUniqueMarkdownUri(documentsFolderUri: vscode.Uri, safeBaseName: string): Promise<vscode.Uri> {
    let index = 0;

    while (true) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const fileName = `${safeBaseName}${suffix}.md`;
      const candidateUri = vscode.Uri.joinPath(documentsFolderUri, fileName);

      try {
        await vscode.workspace.fs.stat(candidateUri);
        index += 1;
      } catch {
        return candidateUri;
      }
    }
  }

  private getSafeBaseName(baseName: string): string {
    const safeName = baseName
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return safeName || 'document';
  }

  private isMarkdownFile(extension: string): boolean {
    return ['.md', '.markdown'].includes(extension.toLowerCase());
  }

  private toWorkspacePath(workspaceRoot: string, filePath: string): string {
    return path.relative(workspaceRoot, filePath).split(path.sep).join('/');
  }
}
