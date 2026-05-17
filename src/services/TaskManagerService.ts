import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as https from 'https';
import type { BrowserContext, Page } from 'playwright';
import { execFile, spawn } from 'child_process';
import { createRequire } from 'module';
import { promisify } from 'util';
import { ConfigService } from './ConfigService';
import { FileSystemService } from './FileSystemService';
import { MemoryService } from '../features/memory/MemoryService';
import { compressAgentText } from '../features/compression';
import { WorkflowStorageService } from '../features/workflows/WorkflowStorageService';
import { parseWorkflow, stringifyWorkflow } from '../features/workflows/yaml';
import {
  WORKFLOW_FILE_VERSION,
  type WorkflowBlock,
  type WorkflowFile,
  type WorkflowParallelBlock,
  type WorkflowStepBlock,
  type WorkflowStepType
} from '../features/workflows/types';
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
  TaskItemSummary,
  TaskItemType,
  TaskJiraConnection,
  TaskJiraOpenRequest,
  TaskJiraReadRequest,
  TaskJiraTicket,
  TaskMarkdownContent,
  TaskMarkdownRequest,
  TaskMarkdownUpdateRequest,
  TaskWorkflowRunRequest,
  TaskWorkflowStepDoneRequest,
  TaskManagerItem,
  TaskManagerMode,
  TaskManagerState,
  TaskProcessNode
} from '../models/TaskManager';

const execFileAsync = promisify(execFile);
export const PROJECT_FOLDER = '.project';
export const DEFAULT_TASK_DOCUMENTS_FOLDER = '.project/docs';
const MARKITDOWN_MAX_BUFFER = 100 * 1024 * 1024;
const FIGMA_NODE_LIST_MAX_DEPTH = 2;
const JIRA_BROWSER_PROFILE_FOLDER = 'jira-playwright-profile';
const JIRA_PAGE_TIMEOUT_MS = 60000;
const JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS = 12;
const JIRA_EMPTY_CONTENT_RETRY_DELAY_MS = 10000;
const JIRA_EMPTY_CONTENT_ERROR = 'No Jira title, description, or comments were found on the current page.';
const TASK_MARKDOWN_DOCUMENT_LIMIT = 5;
const TASK_MARKDOWN_DOCUMENT_CHAR_LIMIT = 1400;
const TASK_MARKDOWN_GUIDE_RELATIVE_PATH = ['webview', 'execution', 'condensed', 'guide.md'];
const TASK_MARKDOWN_BUNDLED_GUIDE_RELATIVE_PATH = ['execution', 'condensed', 'guide.md'];
const DOCUMENT_JUDGMENT_GUIDE_RELATIVE_PATH = ['webview', 'execution', 'condensed', 'judgment-doc.md'];
const DOCUMENT_JUDGMENT_BUNDLED_GUIDE_RELATIVE_PATH = ['execution', 'condensed', 'judgment-doc.md'];
const DOCUMENT_JUDGMENT_DOCUMENT_LIMIT = 8;
const DOCUMENT_JUDGMENT_DOCUMENT_CHAR_LIMIT = 12000;
const DOCUMENT_JUDGMENT_TIMEOUT_MS = 10 * 60 * 1000;
const DOCUMENT_JUDGMENT_INPUT_FILE_NAME = '.document-judgment-input.md';
const MARKITDOWN_TERMINAL_TIMEOUT_MS = 10 * 60 * 1000;
export const JIRA_MARKDOWN_FILE_NAME = 'jira.md';
export const TASK_ITEM_METADATA_FILE_NAME = 'item.json';
export const TASK_ITEM_WORKFLOW_FILE_NAME = 'workflow.yaml';
export const TASK_ITEM_FOLDERS: Record<TaskItemType, string> = {
  task: 'task',
  bug: 'task',
  analysis: 'analysis'
};
const LEGACY_TASK_ITEM_FOLDERS: Partial<Record<TaskItemType, string>> = {
  bug: 'bug'
};
const TASK_TYPE_TO_MODE: Record<TaskItemType, TaskManagerMode> = {
  task: 'task',
  bug: 'task',
  analysis: 'analysis'
};

function getTaskItemTypeForMode(mode: TaskManagerMode): TaskItemType {
  if (mode === 'fix-bug') {
    return 'bug';
  }

  return mode === 'analysis' ? 'analysis' : 'task';
}

interface MarkitdownCandidate {
  command: string;
  args: string[];
  label: string;
}

interface MarkitdownTerminalJob {
  name: string;
  targetPath: string;
  candidates: MarkitdownCandidate[];
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

interface TaskItemMetadata {
  id: string;
  type: TaskItemType;
  workflowId?: string;
  sourceDocuments?: string[];
  createdAt?: string;
  updatedAt: string;
}

interface TaskItemWorkflowSnapshot {
  workflow: WorkflowFile;
  source: string;
}

type TaskFeatureSummaryStatus = 'complete' | 'running' | 'failed' | 'missing' | 'pending' | 'skipped';

interface TaskFeatureSummary {
  title: string;
  status: TaskFeatureSummaryStatus;
}

export class TaskManagerService {
  private configService: ConfigService;
  private fileSystemService: FileSystemService;
  private storageUri?: vscode.Uri;
  private extensionUri?: vscode.Uri;
  private workflowStorage = new WorkflowStorageService();
  private currentItem?: TaskManagerItem;
  private figmaConnection?: TaskFigmaConnection;
  private jiraConnection?: TaskJiraConnection;
  private jiraBrowserContext?: BrowserContext;
  private jiraPage?: Page;
  private memoryService?: MemoryService;

  setMemoryService(service: MemoryService): void {
    this.memoryService = service;
  }

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
    const workflows = await this.workflowStorage.listWorkflows();

    if (!workspaceFolder) {
      return {
        mode,
        items: [],
        currentWorkflow: undefined,
        projectFolder: PROJECT_FOLDER,
        documentsFolder: this.getDocumentsRelativeFolder(),
        sourceDocuments: [],
        documents: [],
        nodes: this.getProcessNodes('Unknown', 'Missing'),
        workflows,
        figma: undefined,
        jira: undefined
      };
    }

    const items = await this.listTaskItems(workspaceFolder, workflows);
    const currentItem = this.resolveStateItem(items, mode, itemReference);
    const stateMode = currentItem ? TASK_TYPE_TO_MODE[currentItem.type] : mode;
    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    const documents = await this.listMarkdownDocuments(workspaceFolder, documentsFolderUri);
    const sourceDocuments = currentItem
      ? await this.listTaskSourceDocuments(workspaceFolder, documentsFolderUri, currentItem)
      : [];
    const documentStatus = documents.length > 0 ? 'Ready' : 'Missing';
    const isSameItem = Boolean(currentItem && this.currentItem?.id === currentItem.id && this.currentItem?.type === currentItem.type);
    const loadedFigmaConnection = isSameItem ? this.figmaConnection : undefined;
    const loadedJiraConnection = currentItem ? await this.readJiraConnection(workspaceFolder, currentItem) : undefined;
    const currentWorkflow = currentItem
      ? await this.readTaskItemWorkflow(workspaceFolder, currentItem.type, currentItem.id)
        || workflows.find(workflow => workflow.id === currentItem.workflowId)
      : undefined;

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
      currentWorkflow,
      projectFolder: PROJECT_FOLDER,
      documentsFolder,
      sourceDocuments,
      documents,
      nodes: this.getProcessNodes(
        documentStatus,
        this.getMarkdownStatus(documents.length > 0, currentItem, loadedFigmaConnection, loadedJiraConnection),
        loadedFigmaConnection,
        loadedJiraConnection
      ),
      workflows,
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
    const itemId = this.normalizeCreatedTaskItemId(request.name || request.id || '');
    const itemFolderUri = this.getTaskItemFolderUri(workspaceFolder, itemType, itemId);
    const workflowSnapshot = request.workflowId
      ? await this.resolveSelectedWorkflowSnapshot(request.workflowId)
      : undefined;

    await vscode.workspace.fs.createDirectory(itemFolderUri);
    await vscode.workspace.fs.createDirectory(this.getProjectTypeFolderUri(workspaceFolder, itemType));
    await this.writeTaskItemMetadata(workspaceFolder, itemType, itemId, request.workflowId);
    if (workflowSnapshot) {
      await this.writeTaskItemWorkflow(workspaceFolder, itemType, itemId, workflowSnapshot.source);
    }

    const item = await this.getTaskItem(workspaceFolder, itemType, itemId, workflowSnapshot ? [workflowSnapshot.workflow] : []);
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
    this.figmaConnection = undefined;
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
    for (const legacyMarkdownUri of this.getLegacyTaskItemMarkdownUris(workspaceFolder, item.type, item.id)) {
      await this.deleteUriIfExists(legacyMarkdownUri, {
        recursive: false,
        useTrash: true
      });
    }
    await this.deleteUriIfExists(this.getLegacyTaskItemFolderUri(workspaceFolder, item.type, item.id), {
      recursive: true,
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
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, upload.mode || 'task', upload);

    if (!upload.fileName || !upload.contentBase64) {
      throw new Error('Missing document upload data');
    }

    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    await vscode.workspace.fs.createDirectory(documentsFolderUri);

    const sourceBuffer = Buffer.from(upload.contentBase64, 'base64');
    const safeFileName = this.getSafeDocumentFileName(upload.fileName);
    const targetUri = await this.getUniqueSourceDocumentUri(documentsFolderUri, safeFileName);
    await vscode.workspace.fs.writeFile(targetUri, sourceBuffer);

    const document = {
      name: path.basename(targetUri.fsPath),
      workspacePath: this.toWorkspacePath(workspaceFolder.fsPath, targetUri.fsPath)
    };

    await this.appendTaskSourceDocument(workspaceFolder, item.type, item.id, document.workspacePath);

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
      throw new Error('Sync a Figma link before selecting nodes.');
    }

    const availableNodeIds = new Set(this.figmaConnection.nodes.map(node => node.id));
    const selectedNodeIds = this.getUniqueFigmaNodeIds(request.selectedNodeIds)
      .filter(nodeId => availableNodeIds.has(nodeId));

    this.figmaConnection = {
      ...this.figmaConnection,
      selectedNodeIds
    };
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
    const generatedAt = new Date().toISOString();

    if (request.regenerate) {
      const regenerated = await this.generateTaskMarkdown(mode, item);
      await this.writeTaskMarkdown(workspaceFolder, item, regenerated);
    }

    let content = await this.readTaskMarkdown(workspaceFolder, item);

    if (!content) {
      content = await this.generateTaskMarkdown(mode, item);
      await this.writeTaskMarkdown(workspaceFolder, item, content);
    }

    const updatedAt = await this.getTaskMarkdownUpdatedAt(workspaceFolder, item);
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
    await this.writeTaskMarkdown(workspaceFolder, item, request.content);
    const updatedAt = new Date().toISOString();
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

  async getTaskWorkflowForRun(
    request: TaskWorkflowRunRequest
  ): Promise<{ workflow: WorkflowFile; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const workflow = await this.resolveTaskWorkflow(workspaceFolder, item);

    if (workflow.blocks.length === 0) {
      throw new Error('Add at least one workflow step before running this item.');
    }

    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });

    return { workflow, state };
  }

  async saveTaskWorkflow(
    request: TaskWorkflowRunRequest,
    workflow: WorkflowFile
  ): Promise<{ workflow: WorkflowFile; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);

    await this.writeTaskItemWorkflow(workspaceFolder, item.type, item.id, stringifyWorkflow(workflow));
    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });

    return {
      workflow: state.currentWorkflow || workflow,
      state
    };
  }

  async markWorkflowStepDone(
    request: TaskWorkflowStepDoneRequest
  ): Promise<{ workflow: WorkflowFile; state: TaskManagerState }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const workflow = await this.resolveTaskWorkflow(workspaceFolder, item);
    const matched = this.findWorkflowStepForCompletion(workflow, request);

    if (!matched) {
      throw new Error('The selected workflow step was not found.');
    }

    matched.step.status = 'success';
    if (matched.parent) {
      matched.parent.status = matched.parent.children.every(child => child.status === 'success' || child.status === 'skipped')
        ? 'success'
        : 'idle';
    }

    await this.writeTaskItemWorkflow(workspaceFolder, item.type, item.id, stringifyWorkflow(workflow));
    const state = await this.getState(TASK_TYPE_TO_MODE[item.type], {
      itemId: item.id,
      itemType: item.type
    });

    return {
      workflow: state.currentWorkflow || workflow,
      state
    };
  }

  async judgeTaskDocumentsWithClaude(
    request: TaskWorkflowRunRequest
  ): Promise<{ ready: boolean; message: string; report: string }> {
    const workspaceFolder = await this.requireWorkspaceFolder();
    const item = await this.resolveOperationItem(workspaceFolder, request.mode || 'task', request);
    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    const documents = await this.prepareTaskDocumentsForJudgment(workspaceFolder, item, documentsFolderUri);

    if (documents.length === 0) {
      throw new Error('Select at least one document before running Collect Document.');
    }

    const guide = await this.getDocumentJudgmentGuide();
    const prompt = await this.createDocumentJudgmentPrompt(workspaceFolder, documentsFolder, documents, guide);
    const promptFile = await this.writeDocumentJudgmentInput(workspaceFolder, item, prompt);

    try {
      let report = await this.runClaudeDocumentJudgment(promptFile.workspacePath, workspaceFolder.fsPath);
      let judgment = this.parseDocumentJudgmentReport(report);

      if (!judgment.statusFound) {
        const normalizedReport = await this.normalizeClaudeDocumentJudgmentReport(
          report,
          promptFile.workspacePath,
          workspaceFolder.fsPath
        );
        report = [
          report,
          '',
          '--- Normalized Judgment ---',
          normalizedReport
        ].join('\n');
        judgment = this.parseDocumentJudgmentReport(normalizedReport);
      }

      if (!judgment.ready) {
        throw new Error(judgment.message);
      }

      return {
        ready: true,
        message: judgment.message,
        report
      };
    } finally {
      await this.deleteDocumentJudgmentInput(promptFile.uri);
    }
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
      throw new Error('Jira is still on the login page. Log in in Chrome, then click RUN again.');
    }

    const ticket = await this.extractJiraTicketWithRetry(page, jiraLink);
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
    if (item && item.hasMarkdown) {
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
    const figmaConnection = this.figmaConnection;
    const jiraConnection = workspaceFolder ? await this.readJiraConnection(workspaceFolder, item) : undefined;
    const figmaNodes = this.getSelectedFigmaNodes(figmaConnection);
    const ticket = jiraConnection?.ticket;
    const guide = await this.getTaskMarkdownGuide();

    let content = this.fillTaskMarkdownGuide(
      guide,
      mode,
      item,
      documentSummaries,
      documentsFolder,
      figmaConnection,
      figmaNodes,
      ticket
    );

    if (this.memoryService) {
      const memoryContext = await this.memoryService.getRelevantContext({
        keywords: [item.id, mode],
        jiraKeys: ticket?.key ? [ticket.key] : undefined,
        figmaNodeIds: figmaConnection?.selectedNodeIds
      });
      if (memoryContext) {
        content = `${content}\n\n${memoryContext}`;
      }
    }

    return content;
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
      '- Keep the change scoped to the item described here.',
      '- Verify behavior with the most relevant build, lint, or manual checks available in this repository.'
    ].join('\n');
  }

  private async getDocumentJudgmentGuide(): Promise<string> {
    const candidates = this.extensionUri
      ? [
        path.join(this.extensionUri.fsPath, 'src', ...DOCUMENT_JUDGMENT_GUIDE_RELATIVE_PATH),
        path.join(this.extensionUri.fsPath, 'dist', ...DOCUMENT_JUDGMENT_BUNDLED_GUIDE_RELATIVE_PATH),
        path.join(this.extensionUri.fsPath, ...DOCUMENT_JUDGMENT_BUNDLED_GUIDE_RELATIVE_PATH)
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
      '# Document Judgment',
      '',
      'Decide whether the imported markdown documents contain enough concrete requirements for development.',
      'Return STATUS: READY only when the documents include clear objective, scope, acceptance criteria, and key edge cases.',
      'Return STATUS: FAIL when critical requirements are missing, ambiguous, conflicting, inaccessible, or not development-ready.',
      'Do not use any other status values.'
    ].join('\n');
  }

  private async prepareTaskDocumentsForJudgment(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem,
    documentsFolderUri: vscode.Uri
  ): Promise<TaskDocument[]> {
    const sourceDocuments = await this.listTaskSourceDocuments(workspaceFolder, documentsFolderUri, item);

    if (sourceDocuments.length === 0) {
      throw new Error('Select at least one document before running Collect Document.');
    }

    await vscode.workspace.fs.createDirectory(documentsFolderUri);

    const terminalJobs: MarkitdownTerminalJob[] = [];

    for (const sourceDocument of sourceDocuments) {
      const sourceUri = vscode.Uri.joinPath(workspaceFolder, ...sourceDocument.workspacePath.split(/[\\/]+/).filter(Boolean));
      const targetUri = this.getMarkdownTargetUriForSource(documentsFolderUri, sourceDocument.name);
      const sourcePath = sourceUri.fsPath;

      if (this.isMarkdownFile(path.extname(sourcePath))) {
        if (path.resolve(sourceUri.fsPath) !== path.resolve(targetUri.fsPath)) {
          await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: true });
        }
        continue;
      }

      const candidates = await this.getAvailableMarkitdownCandidates(sourcePath);
      if (candidates.length === 0) {
        throw new Error(`Unable to find markitdown for ${sourceDocument.name}. ${this.getMarkitdownInstallHint(sourcePath)}`);
      }

      terminalJobs.push({
        name: sourceDocument.name,
        targetPath: targetUri.fsPath,
        candidates
      });
    }

    if (terminalJobs.length > 0) {
      await this.runMarkitdownJobsInTerminal(terminalJobs, workspaceFolder.fsPath);
    }

    return this.listMarkdownDocuments(workspaceFolder, documentsFolderUri);
  }

  private async runMarkitdownJobsInTerminal(
    jobs: MarkitdownTerminalJob[],
    workspaceRoot: string
  ): Promise<void> {
    if (process.platform !== 'win32') {
      await this.runMarkitdownJobsSilently(jobs);
      return;
    }

    const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentkit-markitdown-terminal-'));
    const scriptPath = path.join(runDir, 'convert-documents.ps1');
    const launcherPath = path.join(runDir, 'launch-markitdown.cmd');
    const sentinelPath = path.join(runDir, 'exit-code.txt');
    const logPath = path.join(runDir, 'markitdown.log');
    const script = this.createPowerShellMarkitdownScript(jobs, sentinelPath, logPath);
    const launcher = this.createCmdMarkitdownLauncher(scriptPath, workspaceRoot, sentinelPath, logPath);

    await fs.writeFile(scriptPath, script, 'utf8');
    await fs.writeFile(launcherPath, launcher, 'utf8');

    const child = spawn('cmd.exe', ['/d', '/c', 'start', '', 'cmd.exe', '/k', launcherPath], {
      cwd: workspaceRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    const launchError = await this.waitForProcessLaunch(child);
    if (launchError) {
      throw new Error(`Unable to open MarkItDown shell window. ${launchError.message}`);
    }
    child.unref();

    const exitCode = await this.waitForTerminalExitCode(sentinelPath, MARKITDOWN_TERMINAL_TIMEOUT_MS);
    if (exitCode === '0') {
      return;
    }

    const log = await this.readOptionalTextFile(logPath);
    throw new Error(`Unable to convert selected document(s) with markitdown. ${log || 'See the NWA MarkItDown window for details.'}`);
  }

  private async runMarkitdownJobsSilently(jobs: MarkitdownTerminalJob[]): Promise<void> {
    for (const job of jobs) {
      let lastErrorMessage = '';
      let converted = false;

      for (const candidate of job.candidates) {
        try {
          const result = await execFileAsync(candidate.command, candidate.args, {
            windowsHide: true,
            maxBuffer: MARKITDOWN_MAX_BUFFER
          });
          await fs.mkdir(path.dirname(job.targetPath), { recursive: true });
          await fs.writeFile(job.targetPath, result.stdout);
          converted = true;
          break;
        } catch (error) {
          lastErrorMessage = this.getExecErrorMessage(candidate, error as Error);
        }
      }

      if (!converted) {
        throw new Error(
          `Unable to convert ${job.name} with markitdown. ${this.getMarkitdownInstallHint(job.name)} ${lastErrorMessage}`
        );
      }
    }
  }

  private createCmdMarkitdownLauncher(
    scriptPath: string,
    workspaceRoot: string,
    sentinelPath: string,
    logPath: string
  ): string {
    return [
      '@echo off',
      'title NWA MarkItDown',
      `cd /d ${this.toBatchQuoted(workspaceRoot)}`,
      'echo Running MarkItDown conversion...',
      `${this.toBatchQuoted(this.getWindowsPowerShellPath())} -NoProfile -ExecutionPolicy Bypass -File ${this.toBatchQuoted(scriptPath)}`,
      'echo.',
      'set "NWA_MARKITDOWN_EXIT=1"',
      `if exist ${this.toBatchQuoted(sentinelPath)} set /p NWA_MARKITDOWN_EXIT=<${this.toBatchQuoted(sentinelPath)}`,
      'if "%NWA_MARKITDOWN_EXIT%"=="0" (',
      '  echo MarkItDown window finished. Closing this window...',
      '  timeout /t 1 /nobreak >nul',
      '  exit',
      ')',
      'echo MarkItDown window finished with errors. This window will stay open.',
      `echo Log: ${logPath}`,
      ''
    ].join('\r\n');
  }

  private createPowerShellMarkitdownScript(
    jobs: MarkitdownTerminalJob[],
    sentinelPath: string,
    logPath: string
  ): string {
    const jobBlocks = jobs.map(job => [
      '[pscustomobject]@{',
      `  Name = ${this.toPowerShellLiteral(job.name)}`,
      `  Target = ${this.toPowerShellLiteral(job.targetPath)}`,
      '  Candidates = @(',
      job.candidates.map(candidate => [
        '    [pscustomobject]@{',
        `      Label = ${this.toPowerShellLiteral(candidate.label)}`,
        `      Command = ${this.toPowerShellLiteral(candidate.command)}`,
        `      Args = @(${candidate.args.map(arg => this.toPowerShellLiteral(arg)).join(', ')})`,
        '    }'
      ].join('\n')).join(',\n'),
      '  )',
      '}'
    ].join('\n')).join(',\n');

    return [
      '$ErrorActionPreference = "Continue"',
      '$Host.UI.RawUI.WindowTitle = "NWA MarkItDown"',
      `$sentinel = ${this.toPowerShellLiteral(sentinelPath)}`,
      `$log = ${this.toPowerShellLiteral(logPath)}`,
      '$tmpRoot = Split-Path -Parent $sentinel',
      'New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null',
      'Set-Content -LiteralPath $log -Value "" -Encoding UTF8',
      `$jobs = @(\n${jobBlocks}\n)`,
      '$allOk = $true',
      'foreach ($job in @($jobs)) {',
      '  Write-Host ""',
      '  Write-Host "Converting $($job.Name) with markitdown..."',
      '  Add-Content -LiteralPath $log -Value "Converting $($job.Name)"',
      '  $jobOk = $false',
      '  foreach ($candidate in @($job.Candidates)) {',
      '    $tmpOutput = Join-Path $tmpRoot ([guid]::NewGuid().ToString() + ".md")',
      '    $tmpError = Join-Path $tmpRoot ([guid]::NewGuid().ToString() + ".err")',
      '    Write-Host "Trying $($candidate.Label)"',
      '    Add-Content -LiteralPath $log -Value "Trying $($candidate.Label)"',
      '    $global:LASTEXITCODE = $null',
      '    & $candidate.Command @($candidate.Args) 1> $tmpOutput 2> $tmpError',
      '    $ok = $?',
      '    $exitCode = if ($null -eq $global:LASTEXITCODE) { if ($ok) { 0 } else { 1 } } else { [int]$global:LASTEXITCODE }',
      '    if ($exitCode -eq 0 -and (Test-Path -LiteralPath $tmpOutput)) {',
      '      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $job.Target) | Out-Null',
      '      Move-Item -LiteralPath $tmpOutput -Destination $job.Target -Force',
      '      Write-Host "Saved markdown to $($job.Target)"',
      '      Add-Content -LiteralPath $log -Value "Saved markdown to $($job.Target)"',
      '      $jobOk = $true',
      '      break',
      '    }',
      '    $details = ""',
      '    if (Test-Path -LiteralPath $tmpError) { $details = (Get-Content -LiteralPath $tmpError -Raw) }',
      '    if (-not $details -and (Test-Path -LiteralPath $tmpOutput)) { $details = (Get-Content -LiteralPath $tmpOutput -Raw) }',
      '    $message = "Candidate failed: $($candidate.Label) exit=$exitCode $details"',
      '    Write-Warning $message',
      '    Add-Content -LiteralPath $log -Value $message',
      '  }',
      '  if (-not $jobOk) {',
      '    $allOk = $false',
      '    break',
      '  }',
      '}',
      'if ($allOk) {',
      '  [System.IO.File]::WriteAllText($sentinel, "0", [System.Text.Encoding]::ASCII)',
      '  Write-Host "MarkItDown conversion complete."',
      '  return',
      '}',
      '[System.IO.File]::WriteAllText($sentinel, "1", [System.Text.Encoding]::ASCII)',
      'Write-Error "MarkItDown conversion failed. See log: $log"',
      ''
    ].join('\n');
  }

  private createCmdClaudeJudgmentLauncher(
    scriptPath: string,
    workspaceRoot: string,
    sentinelPath: string,
    logPath: string,
    operationLabel: string
  ): string {
    return [
      '@echo off',
      'title NWA Claude Judgment',
      `cd /d ${this.toBatchQuoted(workspaceRoot)}`,
      `echo Running ${operationLabel}...`,
      `${this.toBatchQuoted(this.getWindowsPowerShellPath())} -NoProfile -ExecutionPolicy Bypass -File ${this.toBatchQuoted(scriptPath)}`,
      'echo.',
      'set "NWA_CLAUDE_EXIT=1"',
      `if exist ${this.toBatchQuoted(sentinelPath)} set /p NWA_CLAUDE_EXIT=<${this.toBatchQuoted(sentinelPath)}`,
      'if "%NWA_CLAUDE_EXIT%"=="0" (',
      '  echo Claude judgment window finished. Closing this window...',
      '  timeout /t 1 /nobreak >nul',
      '  exit',
      ')',
      'echo Claude judgment window finished with errors. This window will stay open.',
      `echo Log: ${logPath}`,
      ''
    ].join('\r\n');
  }

  private createPowerShellClaudeJudgmentScript(
    candidates: MarkitdownCandidate[],
    promptPath: string,
    reportPath: string,
    sentinelPath: string,
    logPath: string
  ): string {
    const candidateBlocks = candidates.map(candidate => [
      '[pscustomobject]@{',
      `  Label = ${this.toPowerShellLiteral(candidate.label)}`,
      `  Command = ${this.toPowerShellLiteral(candidate.command)}`,
      `  Args = @(${candidate.args.map(arg => this.toPowerShellLiteral(arg)).join(', ')})`,
      '}'
    ].join('\n')).join(',\n');

    return [
      '$ErrorActionPreference = "Continue"',
      '$Host.UI.RawUI.WindowTitle = "NWA Claude Judgment"',
      `$promptPath = ${this.toPowerShellLiteral(promptPath)}`,
      `$report = ${this.toPowerShellLiteral(reportPath)}`,
      `$sentinel = ${this.toPowerShellLiteral(sentinelPath)}`,
      `$log = ${this.toPowerShellLiteral(logPath)}`,
      '$tmpRoot = Split-Path -Parent $sentinel',
      'New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null',
      'Set-Content -LiteralPath $log -Value "" -Encoding UTF8',
      'Set-Content -LiteralPath $report -Value "" -Encoding UTF8',
      `$candidates = @(\n${candidateBlocks}\n)`,
      '$promptText = Get-Content -LiteralPath $promptPath -Raw',
      'foreach ($candidate in @($candidates)) {',
      '  Write-Host ""',
      '  Write-Host "Trying $($candidate.Label)"',
      '  Add-Content -LiteralPath $log -Value "Trying $($candidate.Label)"',
      '  $global:LASTEXITCODE = $null',
      '  try {',
      '    $output = $promptText | & $candidate.Command @($candidate.Args) -p 2>&1',
      '    $ok = $?',
      '    $exitCode = if ($null -eq $global:LASTEXITCODE) { if ($ok) { 0 } else { 1 } } else { [int]$global:LASTEXITCODE }',
      '    $outputText = ($output | Out-String).Trim()',
      '    Set-Content -LiteralPath $report -Value $outputText -Encoding UTF8',
      '    if ($outputText) { Write-Host $outputText }',
      '    if ($exitCode -eq 0 -and $outputText.Length -gt 0) {',
      '      [System.IO.File]::WriteAllText($sentinel, "0", [System.Text.Encoding]::ASCII)',
      '      Write-Host "Claude judgment complete."',
      '      return',
      '    }',
      '    $message = "Candidate failed: $($candidate.Label) exit=$exitCode $outputText"',
      '    Write-Warning $message',
      '    Add-Content -LiteralPath $log -Value $message',
      '  } catch {',
      '    $message = "Candidate failed: $($candidate.Label) $($_.Exception.Message)"',
      '    Write-Warning $message',
      '    Add-Content -LiteralPath $log -Value $message',
      '  }',
      '}',
      '[System.IO.File]::WriteAllText($sentinel, "1", [System.Text.Encoding]::ASCII)',
      'Write-Error "Claude judgment failed. See log: $log"',
      ''
    ].join('\n');
  }

  private async waitForTerminalExitCode(
    sentinelPath: string,
    timeoutMs: number,
    operationLabel = 'terminal process'
  ): Promise<string> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const rawStatus = (await fs.readFile(sentinelPath, 'utf8'))
          .replace(/^\uFEFF/, '')
          .trim();
        const statusMatch = rawStatus.match(/[01]/);
        return statusMatch ? statusMatch[0] : rawStatus;
      } catch {
        await this.sleep(500);
      }
    }

    throw new Error(`Timed out waiting for ${operationLabel} to finish.`);
  }

  private waitForProcessLaunch(child: ReturnType<typeof spawn>): Promise<Error | undefined> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(undefined), 250);
      child.once('exit', code => {
        if (typeof code === 'number' && code !== 0) {
          clearTimeout(timer);
          resolve(new Error(`Launch process exited with code ${code}.`));
        }
      });
      child.once('error', error => {
        clearTimeout(timer);
        resolve(error);
      });
    });
  }

  private async readOptionalTextFile(filePath: string): Promise<string> {
    try {
      return (await fs.readFile(filePath, 'utf8')).replace(/\s+/g, ' ').trim().slice(0, 2000);
    } catch {
      return '';
    }
  }

  private async readOptionalRawTextFile(filePath: string): Promise<string> {
    try {
      return (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '').trim();
    } catch {
      return '';
    }
  }

  private getWindowsPowerShellPath(): string {
    const windowsRoot = process.env.SystemRoot || process.env.WINDIR;
    return windowsRoot
      ? path.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe';
  }

  private toPowerShellLiteral(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  private toBatchQuoted(value: string): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async createDocumentJudgmentPrompt(
    workspaceFolder: vscode.Uri,
    documentsFolder: string,
    documents: TaskDocument[],
    guide: string
  ): Promise<string> {
    const documentSections: string[] = [];

    for (const document of documents.slice(0, DOCUMENT_JUDGMENT_DOCUMENT_LIMIT)) {
      const documentUri = vscode.Uri.joinPath(workspaceFolder, ...document.workspacePath.split(/[\\/]+/).filter(Boolean));
      let content = '';

      try {
        content = Buffer.from(await vscode.workspace.fs.readFile(documentUri)).toString('utf8');
      } catch (error) {
        content = `Unable to read this document: ${(error as Error).message}`;
      }

      documentSections.push([
        `## ${document.name}`,
        `Path: ${document.workspacePath}`,
        '',
        this.condenseTaskMarkdownText(content, DOCUMENT_JUDGMENT_DOCUMENT_CHAR_LIMIT)
      ].join('\n'));
    }

    const omittedCount = Math.max(0, documents.length - DOCUMENT_JUDGMENT_DOCUMENT_LIMIT);
    const omittedNotice = omittedCount > 0
      ? `\n\n${omittedCount} additional document(s) exist in ${documentsFolder} but were omitted from this judgment input.`
      : '';

    return [
      'You are judging whether imported task documents are ready for software development.',
      '',
      'Use these rules as the source of truth:',
      guide.trim(),
      '',
      'Return your answer in this exact header format first:',
      'STATUS: READY',
      'MESSAGE: one concise sentence explaining the decision',
      '',
      'or:',
      'STATUS: FAIL',
      'MESSAGE: one concise sentence explaining the blocker',
      '',
      'Use FAIL for conditional, incomplete, ambiguous, conflicting, inaccessible, or non-development-ready documents.',
      'Do not return OK, PASS, BLOCK, CONDITIONAL, PARTIAL, or UNKNOWN.',
      'If you cannot read or inspect the imported documents, return STATUS: FAIL with the reason in MESSAGE.',
      'Do not add any text before the STATUS line.',
      'Do not modify files. Do not implement the task.',
      '',
      `Imported documents folder: ${documentsFolder}`,
      '',
      '# Imported Documents',
      documentSections.join('\n\n'),
      omittedNotice
    ].join('\n').trim();
  }

  private async writeDocumentJudgmentInput(
    workspaceFolder: vscode.Uri,
    item: TaskManagerItem,
    content: string
  ): Promise<{ uri: vscode.Uri; workspacePath: string }> {
    const promptUri = vscode.Uri.joinPath(
      this.getTaskItemFolderUri(workspaceFolder, item.type, item.id),
      DOCUMENT_JUDGMENT_INPUT_FILE_NAME
    );
    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id));
    await vscode.workspace.fs.writeFile(promptUri, Buffer.from(`${content.trim()}\n`, 'utf8'));

    return {
      uri: promptUri,
      workspacePath: this.toWorkspacePath(workspaceFolder.fsPath, promptUri.fsPath)
    };
  }

  private async deleteDocumentJudgmentInput(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
    } catch {
      // Best-effort cleanup; the next run overwrites the file if it remains.
    }
  }

  private async runClaudeDocumentJudgment(promptWorkspacePath: string, workspaceRoot: string): Promise<string> {
    const prompt = [
      `Read the document judgment input at ${promptWorkspacePath}.`,
      'Validate the imported documents using the rules in that file.',
      'Return exactly STATUS: READY or STATUS: FAIL first, then MESSAGE and any concise supporting details.',
      'If you cannot inspect the documents, return STATUS: FAIL and explain that in MESSAGE.',
      'Do not edit files and do not implement the task.'
    ].join(' ');

    return this.runClaudePromptForDocumentJudgment(prompt, workspaceRoot, 'Claude document judgment');
  }

  private async normalizeClaudeDocumentJudgmentReport(
    previousReport: string,
    promptWorkspacePath: string,
    workspaceRoot: string
  ): Promise<string> {
    const prompt = [
      'Your previous document judgment did not follow the required output format.',
      `If needed, read the original document judgment input at ${promptWorkspacePath}.`,
      'Return exactly two lines and nothing before them.',
      'Line 1 must be either: STATUS: READY',
      'or: STATUS: FAIL',
      'Line 2 must be: MESSAGE: one concise sentence',
      'Use STATUS: FAIL if the documents cannot be inspected, are empty, are ambiguous, or are not enough for development.',
      '',
      'Previous response:',
      this.condenseTaskMarkdownText(previousReport, 4000)
    ].join('\n');

    return this.runClaudePromptForDocumentJudgment(prompt, workspaceRoot, 'Claude document judgment normalization');
  }

  private async runClaudePromptForDocumentJudgment(
    prompt: string,
    workspaceRoot: string,
    operationLabel: string
  ): Promise<string> {
    if (process.platform === 'win32') {
      return this.runClaudePromptInTerminal(prompt, workspaceRoot, operationLabel);
    }

    return this.runClaudePromptSilently(prompt, workspaceRoot, operationLabel);
  }

  private async runClaudePromptInTerminal(
    prompt: string,
    workspaceRoot: string,
    operationLabel: string
  ): Promise<string> {
    const candidates = await this.getAvailableClaudeCandidates();
    if (candidates.length === 0) {
      throw new Error(`Claude document judgment failed. ${this.getClaudeInstallHint()}`);
    }

    const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentkit-claude-judgment-'));
    const promptPath = path.join(runDir, 'claude-judgment-prompt.txt');
    const scriptPath = path.join(runDir, 'run-claude-judgment.ps1');
    const launcherPath = path.join(runDir, 'launch-claude-judgment.cmd');
    const sentinelPath = path.join(runDir, 'exit-code.txt');
    const reportPath = path.join(runDir, 'claude-judgment-output.txt');
    const logPath = path.join(runDir, 'claude-judgment.log');
    const script = this.createPowerShellClaudeJudgmentScript(candidates, promptPath, reportPath, sentinelPath, logPath);
    const launcher = this.createCmdClaudeJudgmentLauncher(scriptPath, workspaceRoot, sentinelPath, logPath, operationLabel);

    await fs.writeFile(promptPath, `${prompt.trim()}\n`, 'utf8');
    await fs.writeFile(scriptPath, script, 'utf8');
    await fs.writeFile(launcherPath, launcher, 'utf8');

    const child = spawn('cmd.exe', ['/d', '/c', 'start', '', 'cmd.exe', '/k', launcherPath], {
      cwd: workspaceRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    const launchError = await this.waitForProcessLaunch(child);
    if (launchError) {
      throw new Error(`Unable to open Claude judgment shell window. ${launchError.message}`);
    }
    child.unref();

    const exitCode = await this.waitForTerminalExitCode(
      sentinelPath,
      DOCUMENT_JUDGMENT_TIMEOUT_MS,
      operationLabel
    );
    const output = await this.readOptionalRawTextFile(reportPath);

    if (exitCode === '0' && output) {
      return output;
    }

    const log = await this.readOptionalTextFile(logPath);
    throw new Error(`${operationLabel} failed. ${output || log || 'See the NWA Claude Judgment window for details.'}`);
  }

  private async runClaudePromptSilently(
    prompt: string,
    workspaceRoot: string,
    operationLabel: string
  ): Promise<string> {
    try {
      const result = await execFileAsync('claude', ['-p', prompt], {
        cwd: workspaceRoot,
        timeout: DOCUMENT_JUDGMENT_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: MARKITDOWN_MAX_BUFFER
      });
      const output = [result.stdout.toString(), result.stderr.toString()]
        .map(part => part.trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();

      if (!output) {
        throw new Error(`Claude returned an empty response for ${operationLabel}.`);
      }

      return output;
    } catch (error) {
      const message = this.getExecErrorText(error as Error);
      throw new Error(`${operationLabel} failed. ${message || (error as Error).message}`);
    }
  }

  private parseDocumentJudgmentReport(report: string): { ready: boolean; message: string; statusFound: boolean } {
    const status = this.getDocumentJudgmentStatus(report);
    const message = this.getDocumentJudgmentMessage(report) ||
      this.condenseTaskMarkdownText(report, 600);

    if (status === 'READY') {
      return {
        ready: true,
        message: message || 'Document judgment passed.',
        statusFound: true
      };
    }

    if (status === 'FAIL') {
      return {
        ready: false,
        message: message || 'Imported documents are not ready for development.',
        statusFound: true
      };
    }

    return {
      ready: false,
      message: `Claude document judgment did not return STATUS: READY or STATUS: FAIL. Raw response: ${this.condenseTaskMarkdownText(report, 300)}`,
      statusFound: false
    };
  }

  private getDocumentJudgmentStatus(report: string): 'READY' | 'FAIL' | undefined {
    const statusLineMatch = report.match(/^\s*(?:[-*]\s*)?(?:>\s*)?(?:#+\s*)?(?:\*\*)?STATUS(?:\*\*)?\s*[:=\-]\s*(.+)$/im);
    const jsonStatusMatch = report.match(/["']status["']\s*:\s*["']([^"']+)["']/i);
    const firstLineMatch = report.match(/^\s*(READY|FAIL)\s*$/im);
    const rawStatus = statusLineMatch?.[1] || jsonStatusMatch?.[1] || firstLineMatch?.[1] || '';
    const normalizedStatus = rawStatus
      .replace(/[`*_]/g, '')
      .replace(/[.,;]+$/g, '')
      .trim()
      .toUpperCase();

    if (/^(FAIL|NOT READY|NOT OK|BLOCK|CONDITIONAL)\b/.test(normalizedStatus)) {
      return 'FAIL';
    }

    if (/^READY\b/.test(normalizedStatus) && !/\b(FAIL|BLOCK|CONDITIONAL|NOT READY|NOT OK)\b/.test(normalizedStatus)) {
      return 'READY';
    }

    return undefined;
  }

  private getDocumentJudgmentMessage(report: string): string {
    return report.match(/^\s*(?:[-*]\s*)?(?:>\s*)?(?:\*\*)?MESSAGE(?:\*\*)?\s*[:=\-]\s*(.+)$/im)?.[1]?.trim() || '';
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
    const objective = item.type === 'bug' || mode === 'fix-bug'
      ? '- Use this condensed context to diagnose and fix the bug in the codebase.'
      : mode === 'analysis'
        ? '- Use this condensed context to analyze the codebase, requirements, and implementation options.'
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
        'No Figma nodes are selected for this item.'
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
        'No Figma nodes are selected for this item.'
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
      throw new Error('Paste a Jira ticket URL before running Collect Jira.');
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

  private async extractJiraTicketWithRetry(page: Page, requestedLink: string): Promise<TaskJiraTicket> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS; attempt++) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: JIRA_PAGE_TIMEOUT_MS }).catch(() => undefined);
        return await this.extractJiraTicket(page, requestedLink);
      } catch (error) {
        lastError = error as Error;

        if (!this.isEmptyJiraContentError(lastError) || attempt >= JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS) {
          throw lastError;
        }

        logger.debug(
          `Jira ticket content was not ready; retrying in ${JIRA_EMPTY_CONTENT_RETRY_DELAY_MS / 1000}s ` +
          `(${attempt}/${JIRA_EMPTY_CONTENT_RETRY_ATTEMPTS})`
        );
        await page.waitForTimeout(JIRA_EMPTY_CONTENT_RETRY_DELAY_MS);
      }
    }

    throw lastError || new Error(JIRA_EMPTY_CONTENT_ERROR);
  }

  private isEmptyJiraContentError(error: Error): boolean {
    return error.message === JIRA_EMPTY_CONTENT_ERROR;
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
      throw new Error(JIRA_EMPTY_CONTENT_ERROR);
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
      throw new Error('Create or select an item before running this step.');
    }

    const item = await this.getTaskItem(workspaceFolder, itemType, itemId);

    if (!await this.uriExists(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id))) {
      throw new Error(`${this.getTaskItemTypeLabel(item.type)} ${item.id} was not found.`);
    }

    this.currentItem = item;
    return item;
  }

  private async listTaskItems(workspaceFolder: vscode.Uri, workflows: WorkflowFile[] = []): Promise<TaskManagerItem[]> {
    const itemsByKey = new Map<string, TaskManagerItem>();

    await this.collectTaskItemsFromFolder(workspaceFolder, 'task', 'task', itemsByKey, workflows);
    await this.collectTaskItemsFromFolder(workspaceFolder, 'analysis', 'analysis', itemsByKey, workflows);
    await this.collectLegacyTaskItemsFromFolder(workspaceFolder, 'bug', 'bug', itemsByKey, workflows);

    return Array.from(itemsByKey.values()).sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      return typeCompare !== 0 ? typeCompare : a.id.localeCompare(b.id);
    });
  }

  private async collectTaskItemsFromFolder(
    workspaceFolder: vscode.Uri,
    folderName: string,
    fallbackType: TaskItemType,
    itemsByKey: Map<string, TaskManagerItem>,
    workflows: WorkflowFile[] = []
  ): Promise<void> {
    const folderUri = vscode.Uri.joinPath(workspaceFolder, PROJECT_FOLDER, folderName);
    let entries: [string, vscode.FileType][];

    try {
      entries = await vscode.workspace.fs.readDirectory(folderUri);
    } catch {
      return;
    }

    for (const [name, fileType] of entries) {
      if (fileType !== vscode.FileType.Directory) {
        continue;
      }

      try {
        const metadata = await this.readTaskItemMetadataFromFolder(workspaceFolder, folderName, name);
        const type = this.normalizeTaskItemType(metadata?.type || fallbackType);

        if (TASK_ITEM_FOLDERS[type] !== folderName) {
          continue;
        }

        const item = await this.getTaskItem(workspaceFolder, type, name, workflows);
        itemsByKey.set(this.getTaskItemKey(item), item);
      } catch (error) {
        logger.warn(`Skipping invalid task manager item ${name}: ${(error as Error).message}`);
      }
    }
  }

  private async collectLegacyTaskItemsFromFolder(
    workspaceFolder: vscode.Uri,
    folderName: string,
    type: TaskItemType,
    itemsByKey: Map<string, TaskManagerItem>,
    workflows: WorkflowFile[] = []
  ): Promise<void> {
    const folderUri = vscode.Uri.joinPath(workspaceFolder, PROJECT_FOLDER, folderName);
    let entries: [string, vscode.FileType][];

    try {
      entries = await vscode.workspace.fs.readDirectory(folderUri);
    } catch {
      return;
    }

    for (const [name, fileType] of entries) {
      if (fileType !== vscode.FileType.Directory) {
        continue;
      }

      try {
        const itemId = this.normalizeTaskItemId(name);
        const itemKey = `${type}:${itemId}`;

        if (itemsByKey.has(itemKey)) {
          continue;
        }

        if (await this.uriExists(this.getTaskItemFolderUri(workspaceFolder, type, itemId))) {
          continue;
        }

        const migrated = await this.migrateLegacyTaskItemFolder(workspaceFolder, type, itemId);
        if (!migrated) {
          continue;
        }

        const item = await this.getTaskItem(workspaceFolder, type, itemId, workflows);
        itemsByKey.set(this.getTaskItemKey(item), item);
      } catch (error) {
        logger.warn(`Skipping invalid legacy task manager item ${name}: ${(error as Error).message}`);
      }
    }
  }

  private async getTaskItem(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string,
    workflows: WorkflowFile[] = []
  ): Promise<TaskManagerItem> {
    const itemType = this.normalizeTaskItemType(type);
    const itemId = this.normalizeTaskItemId(id);
    await this.migrateLegacyTaskItemFolder(workspaceFolder, itemType, itemId);
    const folderUri = this.getTaskItemFolderUri(workspaceFolder, itemType, itemId);
    await this.migrateLegacyTaskMarkdown(workspaceFolder, itemType, itemId);
    await this.ensureTaskItemMetadata(workspaceFolder, itemType, itemId);
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, itemType, itemId);
    const jiraUri = this.getTaskItemJiraUri(workspaceFolder, itemType, itemId);
    const folderStat = await this.statUri(folderUri);
    const markdownStat = await this.statUri(markdownUri);
    const jiraStat = await this.statUri(jiraUri);
    const updatedAt = this.getLatestStatDate([folderStat, markdownStat, jiraStat]);
    const metadata = await this.readTaskItemMetadata(workspaceFolder, itemType, itemId);
    const workflow = await this.readTaskItemWorkflow(workspaceFolder, itemType, itemId)
      || workflows.find(candidate => candidate.id === metadata?.workflowId);
    const summary = this.getTaskItemSummary(
      metadata?.workflowId,
      workflow,
      {
        hasJira: Boolean(jiraStat),
        hasMarkdown: Boolean(markdownStat),
        hasFigmaCache: false
      },
      [markdownStat, jiraStat]
    );

    return {
      id: itemId,
      type: itemType,
      folderPath: this.getTaskItemFolderRelativePath(itemType, itemId),
      markdownPath: this.getTaskItemMarkdownRelativePath(itemType, itemId),
      jiraPath: this.getTaskItemJiraRelativePath(itemType, itemId),
      figmaCachePath: '',
      workflowId: metadata?.workflowId,
      createdAt: folderStat ? new Date(folderStat.ctime).toISOString() : undefined,
      updatedAt: updatedAt ? updatedAt.toISOString() : undefined,
      hasJira: Boolean(jiraStat),
      hasMarkdown: Boolean(markdownStat),
      hasFigmaCache: false,
      summary
    };
  }

  private getTaskItemSummary(
    workflowId: string | undefined,
    workflow: WorkflowFile | undefined,
    availability: { hasJira: boolean; hasMarkdown: boolean; hasFigmaCache: boolean },
    contentStats: Array<vscode.FileStat | undefined>
  ): TaskItemSummary {
    const features = workflow
      ? this.getWorkflowFeatureSummaries(workflow.blocks, availability)
      : this.getFallbackFeatureSummaries(availability);

    features.push({
      title: 'Markdown brief',
      status: availability.hasMarkdown ? 'complete' : 'missing'
    });

    const totalFeatureCount = Math.max(features.length, 1);
    const completedFeatureCount = features.filter(feature => feature.status === 'complete' || feature.status === 'skipped').length;
    const progressPercent = Math.round((completedFeatureCount / totalFeatureCount) * 100);
    const failedFeature = features.find(feature => feature.status === 'failed');
    const runningFeature = features.find(feature => feature.status === 'running');
    const missingFeature = features.find(feature => feature.status === 'missing');
    const pendingFeature = features.find(feature => feature.status === 'pending');
    const currentFeature = runningFeature
      ? runningFeature.title
      : missingFeature
        ? `Needs ${missingFeature.title}`
        : workflow && pendingFeature
          ? pendingFeature.title
          : progressPercent >= 100
            ? 'Ready'
            : 'Collect sources';
    const missingWorkflowWarning = workflowId && !workflow ? 'Selected workflow was not found.' : undefined;

    return {
      usageTokens: this.estimateUsageTokens(contentStats),
      progressPercent,
      completedFeatureCount,
      totalFeatureCount,
      currentFeature,
      warning: failedFeature ? undefined : missingFeature
        ? `${missingFeature.title} is required.`
        : missingWorkflowWarning,
      error: failedFeature ? `${failedFeature.title} failed.` : undefined,
      workflowName: workflow?.name
    };
  }

  private getFallbackFeatureSummaries(
    availability: { hasJira: boolean; hasFigmaCache: boolean }
  ): TaskFeatureSummary[] {
    return [
      {
        title: 'Jira',
        status: availability.hasJira ? 'complete' : 'pending'
      },
      {
        title: 'Figma',
        status: availability.hasFigmaCache ? 'complete' : 'pending'
      }
    ];
  }

  private getWorkflowFeatureSummaries(
    blocks: WorkflowBlock[],
    availability: { hasJira: boolean; hasMarkdown: boolean; hasFigmaCache: boolean }
  ): TaskFeatureSummary[] {
    return blocks.flatMap(block => this.getWorkflowBlockFeatureSummaries(block, availability));
  }

  private getWorkflowBlockFeatureSummaries(
    block: WorkflowBlock,
    availability: { hasJira: boolean; hasMarkdown: boolean; hasFigmaCache: boolean }
  ): TaskFeatureSummary[] {
    if (block.kind === 'parallel') {
      if (block.status === 'running' || block.status === 'failed') {
        return [
          {
            title: block.title || 'Parallel workflow',
            status: block.status
          }
        ];
      }

      return block.children.flatMap(child => this.getWorkflowBlockFeatureSummaries(child, availability));
    }

    return [this.getWorkflowStepFeatureSummary(block, availability)];
  }

  private getWorkflowStepFeatureSummary(
    step: WorkflowStepBlock,
    availability: { hasJira: boolean; hasMarkdown: boolean; hasFigmaCache: boolean }
  ): TaskFeatureSummary {
    if (step.status === 'success') {
      return { title: step.title || this.getWorkflowStepTypeLabel(step.stepType), status: 'complete' };
    }

    if (step.status === 'running' || step.status === 'failed' || step.status === 'skipped') {
      return { title: step.title || this.getWorkflowStepTypeLabel(step.stepType), status: step.status };
    }

    const collectStatus = this.getCollectStepAvailabilityStatus(step.stepType, availability);
    return {
      title: step.title || this.getWorkflowStepTypeLabel(step.stepType),
      status: collectStatus || 'pending'
    };
  }

  private getCollectStepAvailabilityStatus(
    stepType: WorkflowStepType,
    availability: { hasJira: boolean; hasMarkdown: boolean; hasFigmaCache: boolean }
  ): TaskFeatureSummaryStatus | undefined {
    if (stepType === 'collect_jira') {
      return availability.hasJira ? 'complete' : 'missing';
    }

    if (stepType === 'collect_figma') {
      return availability.hasFigmaCache ? 'complete' : 'missing';
    }

    if (stepType === 'collect_document') {
      return availability.hasMarkdown ? 'complete' : 'missing';
    }

    return undefined;
  }

  private getWorkflowStepTypeLabel(stepType: WorkflowStepType): string {
    return String(stepType || 'custom')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, match => match.toUpperCase());
  }

  private estimateUsageTokens(stats: Array<vscode.FileStat | undefined>): number {
    const byteCount = stats.reduce((total, stat) => total + (stat?.size || 0), 0);

    if (byteCount <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(byteCount / 4));
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

  private async migrateLegacyTaskItemFolder(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<boolean> {
    const legacyFolderName = LEGACY_TASK_ITEM_FOLDERS[type];

    if (!legacyFolderName || legacyFolderName === TASK_ITEM_FOLDERS[type]) {
      return true;
    }

    const currentFolderUri = this.getTaskItemFolderUri(workspaceFolder, type, id);

    if (await this.uriExists(currentFolderUri)) {
      return true;
    }

    const legacyFolderUri = this.getLegacyTaskItemFolderUri(workspaceFolder, type, id);

    if (!await this.uriExists(legacyFolderUri)) {
      return true;
    }

    try {
      await vscode.workspace.fs.createDirectory(this.getProjectTypeFolderUri(workspaceFolder, type));
      await vscode.workspace.fs.rename(legacyFolderUri, currentFolderUri, { overwrite: false });
      await this.writeTaskItemMetadata(workspaceFolder, type, id);
      return true;
    } catch (error) {
      logger.warn(`Unable to move legacy task item ${PROJECT_FOLDER}/${legacyFolderName}/${id}: ${(error as Error).message}`);
      return false;
    }
  }

  private async readTaskItemMetadataFromFolder(
    workspaceFolder: vscode.Uri,
    folderName: string,
    id: string
  ): Promise<TaskItemMetadata | undefined> {
    const metadataUri = this.getTaskItemMetadataUriForFolder(workspaceFolder, folderName, id);

    try {
      const payload = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(metadataUri)).toString('utf8')) as Partial<TaskItemMetadata>;

      if (!payload.type) {
        return undefined;
      }

      return {
        id: this.normalizeTaskItemId(payload.id || id),
        type: this.normalizeTaskItemType(payload.type),
        workflowId: payload.workflowId,
        sourceDocuments: Array.isArray(payload.sourceDocuments)
          ? payload.sourceDocuments.filter((value): value is string => typeof value === 'string')
          : undefined,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt || ''
      };
    } catch {
      return undefined;
    }
  }

  private async readTaskItemMetadata(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<TaskItemMetadata | undefined> {
    return this.readTaskItemMetadataFromFolder(workspaceFolder, TASK_ITEM_FOLDERS[type], id);
  }

  private async ensureTaskItemMetadata(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<void> {
    const folderUri = this.getTaskItemFolderUri(workspaceFolder, type, id);

    if (!await this.uriExists(folderUri)) {
      return;
    }

    const metadata = await this.readTaskItemMetadata(workspaceFolder, type, id);

    if (metadata?.type === type && metadata.id === id) {
      return;
    }

    if (type === 'task' && !metadata) {
      return;
    }

    await this.writeTaskItemMetadata(workspaceFolder, type, id, metadata?.workflowId);
  }

  private async writeTaskItemMetadata(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string,
    workflowId?: string,
    sourceDocuments?: string[]
  ): Promise<void> {
    const metadataUri = this.getTaskItemMetadataUri(workspaceFolder, type, id);
    const existing = await this.readTaskItemMetadata(workspaceFolder, type, id);
    const now = new Date().toISOString();
    const selectedSourceDocuments = sourceDocuments || existing?.sourceDocuments || [];
    const metadata: TaskItemMetadata = {
      id,
      type,
      workflowId,
      sourceDocuments: selectedSourceDocuments,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    if (!metadata.workflowId) {
      delete metadata.workflowId;
    }

    if (!metadata.sourceDocuments || metadata.sourceDocuments.length === 0) {
      delete metadata.sourceDocuments;
    }

    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, type, id));
    await vscode.workspace.fs.writeFile(metadataUri, Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, 'utf8'));
  }

  private async appendTaskSourceDocument(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string,
    workspacePath: string
  ): Promise<void> {
    const metadata = await this.readTaskItemMetadata(workspaceFolder, type, id);
    const sourceDocuments = Array.from(new Set([
      ...(metadata?.sourceDocuments || []),
      workspacePath
    ]));

    await this.writeTaskItemMetadata(workspaceFolder, type, id, metadata?.workflowId, sourceDocuments);
  }

  private async resolveSelectedWorkflowSnapshot(workflowId: string): Promise<TaskItemWorkflowSnapshot> {
    const workflows = await this.workflowStorage.listWorkflows();
    const workflow = workflows.find(candidate => candidate.id === workflowId);

    if (!workflow) {
      throw new Error('Selected workflow was not found. Refresh Task Manager and try again.');
    }

    return {
      workflow,
      source: await this.readWorkflowSource(workflow)
    };
  }

  private async readWorkflowSource(workflow: WorkflowFile): Promise<string> {
    const workflowsDir = this.workflowStorage.getWorkflowsDir();

    if (workflowsDir && workflow.fileName) {
      try {
        const source = await fs.readFile(path.join(workflowsDir, workflow.fileName), 'utf8');
        return source.endsWith('\n') ? source : `${source}\n`;
      } catch (error) {
        logger.warn(`Unable to read workflow source ${workflow.fileName}: ${(error as Error).message}`);
      }
    }

    return stringifyWorkflow(workflow);
  }

  private async writeTaskItemWorkflow(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string,
    content: string
  ): Promise<void> {
    const workflowUri = this.getTaskItemWorkflowUri(workspaceFolder, type, id);
    const normalizedContent = content.endsWith('\n') ? content : `${content}\n`;

    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, type, id));
    await vscode.workspace.fs.writeFile(workflowUri, Buffer.from(normalizedContent, 'utf8'));
  }

  private async readTaskItemWorkflow(
    workspaceFolder: vscode.Uri,
    type: TaskItemType,
    id: string
  ): Promise<WorkflowFile | undefined> {
    const workflowUri = this.getTaskItemWorkflowUri(workspaceFolder, type, id);

    if (!await this.uriExists(workflowUri)) {
      return undefined;
    }

    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(workflowUri)).toString('utf8');
      const workflow = parseWorkflow(content);
      return {
        ...workflow,
        fileName: TASK_ITEM_WORKFLOW_FILE_NAME
      };
    } catch (error) {
      logger.warn(`Unable to read task workflow ${workflowUri.fsPath}: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async resolveTaskWorkflow(workspaceFolder: vscode.Uri, item: TaskManagerItem): Promise<WorkflowFile> {
    const itemWorkflow = await this.readTaskItemWorkflow(workspaceFolder, item.type, item.id);

    if (itemWorkflow) {
      return itemWorkflow;
    }

    const workflows = await this.workflowStorage.listWorkflows();
    const selectedWorkflow = workflows.find(workflow => workflow.id === item.workflowId);

    if (selectedWorkflow) {
      return {
        ...selectedWorkflow,
        fileName: TASK_ITEM_WORKFLOW_FILE_NAME,
        blocks: selectedWorkflow.blocks.map(block => this.cloneWorkflowBlock(block))
      };
    }

    return this.createFallbackTaskWorkflow(item);
  }

  private cloneWorkflowBlock(block: WorkflowBlock): WorkflowBlock {
    if (block.kind === 'step') {
      return { ...block };
    }

    return {
      ...block,
      children: block.children.map(child => ({ ...child }))
    };
  }

  private createFallbackTaskWorkflow(item: TaskManagerItem): WorkflowFile {
    return {
      version: WORKFLOW_FILE_VERSION,
      id: `task_${item.type}_${item.id}_workflow`,
      name: 'Task process',
      fileName: TASK_ITEM_WORKFLOW_FILE_NAME,
      blocks: [
        this.createFallbackStep('document', 'collect_document', 'Document'),
        this.createFallbackStep('figma', 'collect_figma', 'Figma'),
        this.createFallbackStep('jira', 'collect_jira', 'Jira'),
        this.createFallbackStep('markdown', 'review_human', 'Human review'),
        this.createFallbackStep('code', 'custom', 'Code'),
        this.createFallbackStep('testcase', 'unit_test', 'Testcase')
      ]
    };
  }

  private createFallbackStep(id: string, stepType: WorkflowStepType, title: string): WorkflowStepBlock {
    return {
      id,
      kind: 'step',
      stepType,
      title,
      status: 'idle'
    };
  }

  private findWorkflowStepForCompletion(
    workflow: WorkflowFile,
    request: TaskWorkflowStepDoneRequest
  ): { step: WorkflowStepBlock; parent?: WorkflowParallelBlock } | undefined {
    const locatorMatch = request.locator ? this.findWorkflowStepByLocator(workflow, request.locator) : undefined;

    if (locatorMatch) {
      return locatorMatch;
    }

    const stepId = String(request.stepId || '').trim();
    if (!stepId) {
      return undefined;
    }

    for (const block of workflow.blocks) {
      if (block.kind === 'step') {
        if (block.id === stepId) {
          return { step: block };
        }
        continue;
      }

      const child = block.children.find(candidate => candidate.id === stepId);
      if (child) {
        return { step: child, parent: block };
      }
    }

    return undefined;
  }

  private findWorkflowStepByLocator(
    workflow: WorkflowFile,
    locator: TaskWorkflowStepDoneRequest['locator']
  ): { step: WorkflowStepBlock; parent?: WorkflowParallelBlock } | undefined {
    if (!locator) {
      return undefined;
    }

    if (locator.type === 'root') {
      const block = workflow.blocks[Number(locator.index)];
      return block?.kind === 'step' ? { step: block } : undefined;
    }

    if (locator.type === 'parallel-child') {
      const parent = workflow.blocks[Number(locator.parentIndex)];
      if (!parent || parent.kind !== 'parallel') {
        return undefined;
      }

      const step = parent.children[Number(locator.childIndex)];
      return step ? { step, parent } : undefined;
    }

    return undefined;
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

    const legacyMarkdownUris = this.getLegacyTaskItemMarkdownUris(workspaceFolder, type, id);

    for (const legacyMarkdownUri of legacyMarkdownUris) {
      if (!await this.uriExists(legacyMarkdownUri)) {
        continue;
      }

      try {
        await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, type, id));
        await vscode.workspace.fs.rename(legacyMarkdownUri, markdownUri, { overwrite: false });
      } catch (error) {
        logger.warn(`Unable to move legacy task markdown ${legacyMarkdownUri.fsPath}: ${(error as Error).message}`);
      }
      return;
    }
  }

  private async readTaskMarkdown(workspaceFolder: vscode.Uri, item: TaskManagerItem): Promise<string | undefined> {
    await this.migrateLegacyTaskMarkdown(workspaceFolder, item.type, item.id);
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id);

    try {
      const content = Buffer.from(await vscode.workspace.fs.readFile(markdownUri)).toString('utf8');
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
    const { compressed, before, after, savedPercent } = compressAgentText(content);
    if (before > after) {
      logger.debug(`Compressed task markdown for ${item.id}: ${before} → ${after} chars (-${savedPercent.toFixed(1)}%)`);
    }
    await vscode.workspace.fs.createDirectory(this.getTaskItemFolderUri(workspaceFolder, item.type, item.id));
    const markdownUri = this.getTaskItemMarkdownUri(workspaceFolder, item.type, item.id);
    await vscode.workspace.fs.writeFile(markdownUri, Buffer.from(compressed.endsWith('\n') ? compressed : `${compressed}\n`, 'utf8'));
  }

  private async ensureTaskMarkdownExists(workspaceFolder: vscode.Uri, item: TaskManagerItem): Promise<void> {
    const existingContent = await this.readTaskMarkdown(workspaceFolder, item);

    if (existingContent?.trim()) {
      return;
    }

    const content = await this.generateTaskMarkdown(TASK_TYPE_TO_MODE[item.type], item);
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
    const lines = [
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
    if (type === 'task' || type === 'bug' || type === 'analysis') {
      return type;
    }

    throw new Error('Choose task, bug, or analysis.');
  }

  private normalizeTaskItemId(id: string): string {
    const trimmedId = String(id || '').trim();

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(trimmedId) || trimmedId === '.' || trimmedId === '..') {
      throw new Error('Use an item name with letters, numbers, dots, underscores, or dashes only.');
    }

    return trimmedId;
  }

  private normalizeCreatedTaskItemId(id: string): string {
    return this.normalizeTaskItemId(id).toUpperCase();
  }

  private getTaskItemKey(item: TaskManagerItem): string {
    return `${item.type}:${item.id}`;
  }

  private getTaskItemTypeLabel(type: TaskItemType): string {
    if (type === 'bug') {
      return 'Bug';
    }

    return type === 'analysis' ? 'Analysis' : 'Task';
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

  private getLegacyTaskItemMarkdownUris(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri[] {
    return this.getLegacyTaskItemMarkdownRelativePaths(type, id)
      .map(relativePath => vscode.Uri.joinPath(workspaceFolder, ...relativePath.split('/')));
  }

  private getTaskItemMetadataUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getTaskItemFolderUri(workspaceFolder, type, id), TASK_ITEM_METADATA_FILE_NAME);
  }

  private getTaskItemWorkflowUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getTaskItemFolderUri(workspaceFolder, type, id), TASK_ITEM_WORKFLOW_FILE_NAME);
  }

  private getTaskItemMetadataUriForFolder(workspaceFolder: vscode.Uri, folderName: string, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, PROJECT_FOLDER, folderName, id, TASK_ITEM_METADATA_FILE_NAME);
  }

  private getLegacyTaskItemFolderUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, PROJECT_FOLDER, LEGACY_TASK_ITEM_FOLDERS[type] || TASK_ITEM_FOLDERS[type], id);
  }

  private getTaskItemJiraUri(workspaceFolder: vscode.Uri, type: TaskItemType, id: string): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder, ...this.getTaskItemJiraRelativePath(type, id).split('/'));
  }


  private getTaskItemFolderRelativePath(type: TaskItemType, id: string): string {
    return `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS[type]}/${id}`;
  }

  private getTaskItemMarkdownRelativePath(type: TaskItemType, id: string): string {
    return `${this.getTaskItemFolderRelativePath(type, id)}/${id}.md`;
  }

  private getLegacyTaskItemMarkdownRelativePaths(type: TaskItemType, id: string): string[] {
    const folderNames = [TASK_ITEM_FOLDERS[type], LEGACY_TASK_ITEM_FOLDERS[type]]
      .filter((folderName, index, names): folderName is string => Boolean(folderName) && names.indexOf(folderName) === index);

    return folderNames.map(folderName => `${PROJECT_FOLDER}/${folderName}/${id}.md`);
  }

  private getTaskItemJiraRelativePath(type: TaskItemType, id: string): string {
    return `${this.getTaskItemFolderRelativePath(type, id)}/${JIRA_MARKDOWN_FILE_NAME}`;
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
      return;
    } catch (error) {
      if (!await this.uriExists(uri)) {
        return;
      }

      if (options.useTrash) {
        try {
          await vscode.workspace.fs.delete(uri, {
            ...options,
            useTrash: false
          });
          logger.warn(`Trash delete failed for ${this.getUriDisplayPath(uri)}; deleted permanently instead.`);
          return;
        } catch (fallbackError) {
          if (await this.uriExists(uri)) {
            throw new Error(`Failed to delete ${this.getUriDisplayPath(uri)}: ${(fallbackError as Error).message}`);
          }
          return;
        }
      }

      if (await this.uriExists(uri)) {
        throw new Error(`Failed to delete ${this.getUriDisplayPath(uri)}: ${(error as Error).message}`);
      }
    }
  }

  private getUriDisplayPath(uri: vscode.Uri): string {
    return uri.fsPath || uri.toString();
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

  private async listTaskSourceDocuments(
    workspaceFolder: vscode.Uri,
    documentsFolderUri: vscode.Uri,
    item: TaskManagerItem
  ): Promise<TaskDocument[]> {
    try {
      const metadata = await this.readTaskItemMetadata(workspaceFolder, item.type, item.id);
      const sourcePaths = metadata?.sourceDocuments || [];
      const documents: TaskDocument[] = [];

      for (const workspacePath of sourcePaths) {
        const safeParts = workspacePath.split(/[\\/]+/).filter(Boolean);
        const documentUri = vscode.Uri.joinPath(workspaceFolder, ...safeParts);

        if (!this.isUriInsideFolder(documentUri, documentsFolderUri)) {
          continue;
        }

        try {
          const stat = await vscode.workspace.fs.stat(documentUri);
          if (stat.type !== vscode.FileType.File) {
            continue;
          }

          documents.push({
            name: path.basename(documentUri.fsPath),
            workspacePath: this.toWorkspacePath(workspaceFolder.fsPath, documentUri.fsPath)
          });
        } catch {
          // Ignore stale source document references.
        }
      }

      return documents.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  private isUriInsideFolder(uri: vscode.Uri, folderUri: vscode.Uri): boolean {
    const relativePath = path.relative(folderUri.fsPath, uri.fsPath);
    return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  private getMarkdownTargetUriForSource(documentsFolderUri: vscode.Uri, sourceName: string): vscode.Uri {
    const parsedName = path.parse(sourceName);
    const safeBaseName = this.getSafeBaseName(parsedName.name || sourceName);
    return vscode.Uri.joinPath(documentsFolderUri, `${safeBaseName}.md`);
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
      return this.dedupeCandidates([...windowsCandidates, ...candidates]);
    }

    return this.dedupeCandidates(candidates);
  }

  private async getAvailableMarkitdownCandidates(sourcePath: string): Promise<MarkitdownCandidate[]> {
    const candidates = await this.getMarkitdownCandidates(sourcePath);
    const available: MarkitdownCandidate[] = [];

    for (const candidate of candidates) {
      if (await this.isCommandAvailable(candidate.command)) {
        available.push(candidate);
      }
    }

    return available;
  }

  private getClaudeCandidates(): MarkitdownCandidate[] {
    const candidates: MarkitdownCandidate[] = [
      { command: 'claude', args: [], label: 'claude' }
    ];

    if (process.platform === 'win32') {
      return this.dedupeCandidates([...candidates, ...this.getWindowsClaudeCandidates()]);
    }

    return this.dedupeCandidates(candidates);
  }

  private async getAvailableClaudeCandidates(): Promise<MarkitdownCandidate[]> {
    const candidates = this.getClaudeCandidates();
    const available: MarkitdownCandidate[] = [];

    for (const candidate of candidates) {
      if (await this.isCommandAvailable(candidate.command)) {
        available.push(candidate);
      }
    }

    return available;
  }

  private getWindowsClaudeCandidates(): MarkitdownCandidate[] {
    const candidates: MarkitdownCandidate[] = [];
    const userProfile = process.env.USERPROFILE;
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;

    if (userProfile) {
      candidates.push(
        { command: path.join(userProfile, '.local', 'bin', 'claude.exe'), args: [], label: 'Claude Code native install' },
        { command: path.join(userProfile, '.local', 'bin', 'claude.cmd'), args: [], label: 'Claude Code native install' }
      );
    }

    if (appData) {
      candidates.push(
        { command: path.join(appData, 'npm', 'claude.cmd'), args: [], label: 'Claude Code npm install' },
        { command: path.join(appData, 'npm', 'claude.exe'), args: [], label: 'Claude Code npm install' }
      );
    }

    if (localAppData) {
      candidates.push(
        { command: path.join(localAppData, 'Programs', 'Claude', 'claude.exe'), args: [], label: 'Claude Code local install' }
      );
    }

    return candidates;
  }

  private async isCommandAvailable(command: string): Promise<boolean> {
    if (path.isAbsolute(command) || command.includes('\\') || command.includes('/')) {
      return this.pathExists(command);
    }

    const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'which';

    try {
      await execFileAsync(lookupCommand, [command], {
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 1024 * 1024
      });
      return true;
    } catch {
      return false;
    }
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

  private getClaudeInstallHint(): string {
    return 'Install Claude Code CLI or run NWA: Init env, then restart VS Code if PATH was changed.';
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

  private async getUniqueSourceDocumentUri(sourceFolderUri: vscode.Uri, safeFileName: string): Promise<vscode.Uri> {
    const parsedName = path.parse(safeFileName);
    const safeBaseName = this.getSafeBaseName(parsedName.name || safeFileName);
    const safeExtension = parsedName.ext || '';
    let index = 0;

    while (true) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const fileName = `${safeBaseName}${suffix}${safeExtension}`;
      const candidateUri = vscode.Uri.joinPath(sourceFolderUri, fileName);

      try {
        await vscode.workspace.fs.stat(candidateUri);
        index += 1;
      } catch {
        return candidateUri;
      }
    }
  }

  private getSafeDocumentFileName(fileName: string): string {
    const parsedName = path.parse(fileName);
    const safeBaseName = this.getSafeBaseName(parsedName.name || parsedName.base || 'document');
    const safeExtension = parsedName.ext
      .replace(/[^a-zA-Z0-9.]+/g, '')
      .slice(0, 24);

    return `${safeBaseName}${safeExtension}`;
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
