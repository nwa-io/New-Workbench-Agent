import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConfigService } from './ConfigService';
import { FileSystemService } from './FileSystemService';
import { logger } from '../utils/logger';
import {
  TaskDocument,
  TaskDocumentUpload,
  TaskManagerMode,
  TaskManagerState,
  TaskProcessNode
} from '../models/TaskManager';

const execFileAsync = promisify(execFile);
const DEFAULT_TASK_DOCUMENTS_FOLDER = '.claude/docs';
const MARKITDOWN_MAX_BUFFER = 100 * 1024 * 1024;

interface MarkitdownCandidate {
  command: string;
  args: string[];
  label: string;
}

export class TaskManagerService {
  private configService: ConfigService;
  private fileSystemService: FileSystemService;

  constructor(configService?: ConfigService, fileSystemService?: FileSystemService) {
    this.configService = configService || new ConfigService();
    this.fileSystemService = fileSystemService || new FileSystemService();
  }

  async getState(mode: TaskManagerMode): Promise<TaskManagerState> {
    const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();

    if (!workspaceFolder) {
      return {
        mode,
        documentsFolder: this.getDocumentsRelativeFolder(),
        documents: [],
        nodes: this.getProcessNodes('Unknown')
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
      nodes: this.getProcessNodes(documentStatus)
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
      { id: 'figma', label: 'Figma', status: 'Un-sync' },
      { id: 'jira', label: 'Jira', status: 'Un-sync' },
      { id: 'code', label: 'Code', status: 'Unknown' },
      { id: 'testcase', label: 'Testcase', status: 'Unknown' }
    ];
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
