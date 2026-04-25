import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

const AGENT_PATHS: Record<string, string> = {
  '.claude': 'agents',
  '.cursorrules': '',
  '.aider': '',
  '.github': 'copilot-instructions',
  '.ai': '',
};

const EXCLUDED_FILENAMES = ['readme.md', 'index.md', 'skill.md'];

export class FileSystemService {
  async getWorkspaceFolder(): Promise<vscode.Uri | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }
    return workspaceFolders[0].uri;
  }

  async folderExists(folderPath: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
      return stat.type === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return stat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString('utf8');
  }

  async getInstalledAgents(workspaceRoot: string): Promise<string[]> {
    const installedAgents: string[] = [];

    for (const [toolFolder, agentSubpath] of Object.entries(AGENT_PATHS)) {
      const agentBasePath = agentSubpath
        ? path.join(workspaceRoot, toolFolder, agentSubpath)
        : path.join(workspaceRoot, toolFolder);

      if (await this.folderExists(agentBasePath)) {
        try {
          const files = await this.listAgentFiles(agentBasePath);
          installedAgents.push(...files.map(f => path.relative(workspaceRoot, f)));
        } catch (error) {
          logger.error(`Error reading folder ${toolFolder}`, error as Error);
        }
      }
    }

    return installedAgents;
  }

  private async listAgentFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.listAgentFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          if (!EXCLUDED_FILENAMES.includes(entry.name.toLowerCase())) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.error(`Error listing files in ${dirPath}`, error as Error);
    }

    return files;
  }

  async revealInExplorer(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand('revealInExplorer', uri);
  }

  async openFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }
}