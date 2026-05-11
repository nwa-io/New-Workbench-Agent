import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseWorkflow, stringifyWorkflow } from './yaml';
import { WORKFLOW_FILE_VERSION, WorkflowFile } from './types';

const WORKFLOWS_DIR = path.join('.project', 'workflows');

export class WorkflowStorageService {
  private getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
  }

  getWorkflowsDir(): string | undefined {
    const root = this.getWorkspaceRoot();
    return root ? path.join(root, WORKFLOWS_DIR) : undefined;
  }

  private slug(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return base || 'workflow';
  }

  private fileNameFor(wf: WorkflowFile): string {
    return `${this.slug(wf.name)}.workflow.yaml`;
  }

  async ensureDir(): Promise<string> {
    const dir = this.getWorkflowsDir();
    if (!dir) {
      throw new Error('No workspace folder is open.');
    }
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async listWorkflows(): Promise<WorkflowFile[]> {
    const dir = this.getWorkflowsDir();
    if (!dir) {
      return [];
    }
    try {
      await fs.access(dir);
    } catch {
      return [];
    }
    const entries = await fs.readdir(dir);
    const files = entries.filter(e => e.endsWith('.workflow.yaml') || e.endsWith('.workflow.yml'));
    const result: WorkflowFile[] = [];
    for (const f of files) {
      try {
        const src = await fs.readFile(path.join(dir, f), 'utf8');
        result.push({
          ...parseWorkflow(src),
          fileName: f
        });
      } catch (err) {
        // skip unreadable files; UI will show what we can load
      }
    }
    return result;
  }

  async saveWorkflow(wf: WorkflowFile): Promise<string> {
    const dir = await this.ensureDir();
    const file = path.join(dir, this.fileNameFor(wf));
    await fs.writeFile(file, stringifyWorkflow(wf), 'utf8');
    return file;
  }

  async deleteWorkflow(wf: WorkflowFile): Promise<void> {
    const dir = this.getWorkflowsDir();
    if (!dir) {
      return;
    }
    const file = path.join(dir, this.fileNameFor(wf));
    try {
      await fs.unlink(file);
    } catch {
      // ignore missing file
    }
  }

  async renameWorkflow(oldWf: WorkflowFile, newWf: WorkflowFile): Promise<string> {
    if (this.fileNameFor(oldWf) !== this.fileNameFor(newWf)) {
      await this.deleteWorkflow(oldWf);
    }
    return this.saveWorkflow(newWf);
  }

  newEmptyWorkflow(name: string): WorkflowFile {
    return {
      version: WORKFLOW_FILE_VERSION,
      id: `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      blocks: []
    };
  }
}
