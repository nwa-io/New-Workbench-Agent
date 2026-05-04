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
  TaskFigmaNode,
  TaskFigmaSyncRequest,
  TaskJiraConnection,
  TaskJiraOpenRequest,
  TaskJiraReadRequest,
  TaskJiraTicket,
  TaskManagerMode,
  TaskManagerState,
  TaskProcessNode
} from '../models/TaskManager';

const execFileAsync = promisify(execFile);
const DEFAULT_TASK_DOCUMENTS_FOLDER = '.claude/docs';
const MARKITDOWN_MAX_BUFFER = 100 * 1024 * 1024;
const FIGMA_NODE_LIST_MAX_DEPTH = 2;
const JIRA_BROWSER_PROFILE_FOLDER = 'jira-playwright-profile';
const JIRA_PAGE_TIMEOUT_MS = 60000;

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
  private figmaConnection?: TaskFigmaConnection;
  private jiraConnection?: TaskJiraConnection;
  private jiraBrowserContext?: BrowserContext;
  private jiraPage?: Page;

  constructor(configService?: ConfigService, fileSystemService?: FileSystemService, storageUri?: vscode.Uri) {
    this.configService = configService || new ConfigService();
    this.fileSystemService = fileSystemService || new FileSystemService();
    this.storageUri = storageUri;
  }

  async getState(mode: TaskManagerMode): Promise<TaskManagerState> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      return {
        mode,
        documentsFolder: this.getDocumentsRelativeFolder(),
        documents: [],
        nodes: this.getProcessNodes('Unknown'),
        figma: this.figmaConnection,
        jira: this.jiraConnection
      };
    }

    const documentsFolder = this.getDocumentsRelativeFolder();
    const documentsFolderUri = vscode.Uri.joinPath(workspaceFolder, ...documentsFolder.split('/'));
    const documents = await this.listMarkdownDocuments(workspaceFolder, documentsFolderUri);
    const documentStatus = documents.length > 0 ? 'Ready' : 'Missing';

    return {
      mode,
      documentsFolder,
      documents,
      nodes: this.getProcessNodes(documentStatus),
      figma: this.figmaConnection,
      jira: this.jiraConnection
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

    const state = await this.getState(upload.mode || 'task');
    return { document, state };
  }

  async syncFigmaLink(
    request: TaskFigmaSyncRequest
  ): Promise<{ connection: TaskFigmaConnection; state: TaskManagerState }> {
    const token = request.token.trim();

    if (!token) {
      throw new Error('Paste a Figma token before syncing.');
    }

    const figmaLink = this.parseFigmaLink(request.link);
    const response = await this.fetchFigmaFile(figmaLink, token);
    const figmaNodes = this.getFigmaNodes(response);
    this.ensureRequestedFigmaNodeExists(response, figmaLink.nodeId);

    const connection: TaskFigmaConnection = {
      link: figmaLink.link,
      fileKey: figmaLink.fileKey,
      nodeId: figmaLink.nodeId,
      fileName: response.name || figmaLink.fileKey,
      nodeName: this.getFigmaNodeName(response, figmaLink.nodeId),
      lastSyncedAt: new Date().toISOString(),
      nodes: figmaNodes
    };

    this.figmaConnection = connection;
    const state = await this.getState(request.mode || 'task');
    return { connection, state };
  }

  async openJiraInChrome(
    request: TaskJiraOpenRequest
  ): Promise<{ connection: TaskJiraConnection; state: TaskManagerState }> {
    const jiraLink = this.parseJiraLink(request.link);
    const { profilePath } = await this.openJiraPage(jiraLink);
    const connection: TaskJiraConnection = {
      ...this.jiraConnection,
      link: jiraLink,
      profilePath,
      lastOpenedAt: new Date().toISOString()
    };

    this.jiraConnection = connection;
    const state = await this.getState(request.mode || 'task');
    return { connection, state };
  }

  async readJiraTicket(
    request: TaskJiraReadRequest
  ): Promise<{ connection: TaskJiraConnection; state: TaskManagerState }> {
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
    const state = await this.getState(request.mode || 'task');
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

  private getProcessNodes(documentStatus: 'Unknown' | 'Ready' | 'Missing'): TaskProcessNode[] {
    return [
      { id: 'document', label: 'Document', status: documentStatus },
      { id: 'figma', label: 'Figma', status: this.figmaConnection ? 'Sync' : 'Un-sync' },
      { id: 'jira', label: 'Jira', status: this.jiraConnection?.ticket ? 'Sync' : 'Un-sync' },
      { id: 'code', label: 'Code', status: 'Unknown' },
      { id: 'testcase', label: 'Testcase', status: 'Unknown' }
    ];
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
      headers['User-Agent'] = 'agentkit-vscode';

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

      const getText = (selectors: string[]): string => {
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            const text = normalize(element?.textContent || '');
            if (text) {
              return text;
            }
          } catch {
            // Ignore unsupported selectors from Jira variants.
          }
        }

        return '';
      };

      const key = getText([
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '[data-testid*="current-issue"]',
        '[data-test-id*="current-issue"]',
        'a[href*="/browse/"]'
      ]);
      const summary = getText([
        '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
        '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
        '[data-testid*="summary.heading"]',
        '[data-test-id*="summary.heading"]',
        'header h1',
        'h1'
      ]);
      const status = getText([
        '[data-testid="issue.fields.status.common.ui.status-lozenge"]',
        '[data-test-id="issue.fields.status.common.ui.status-lozenge"]',
        '[data-testid*="status.status-field-wrapper"]',
        '[data-test-id*="status.status-field-wrapper"]',
        '[data-testid*="status-lozenge"]',
        '[data-test-id*="status-lozenge"]'
      ]);

      return {
        url: window.location.href,
        title: normalize(document.title),
        key,
        summary,
        status,
        content: normalize(document.body?.innerText || document.body?.textContent || '')
      };
    });
    const content = data.content.trim();

    if (!content) {
      throw new Error('No readable Jira ticket content was found on the current page.');
    }

    const key = this.normalizeJiraIssueKey(data.key) ||
      this.getJiraIssueKeyFromUrl(data.url) ||
      this.getJiraIssueKeyFromUrl(requestedLink) ||
      this.getJiraIssueKeyFromText(content);
    const summary = data.summary.trim();
    const title = summary || data.title.trim() || key || data.url;

    return {
      url: data.url,
      title,
      key,
      summary: summary || undefined,
      status: data.status.trim() || undefined,
      content,
      lastReadAt: new Date().toISOString()
    };
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

    return 'Install markitdown or run AgentKit: Init env.';
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
