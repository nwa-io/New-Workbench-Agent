import * as vscode from 'vscode';
import * as path from 'path';
import { getClaudeResourceContent } from './claudeResourceContent';
import { FileSystemService } from '../services/FileSystemService';
import { logger } from '../utils/logger';

interface ClaudeResourceDefinition {
  id: string;
  fileName: string;
  targetPath?: string[];
  backupFileName?: string;
  templateName?: string;
  description: string;
}

const CLAUDE_RESOURCES: ClaudeResourceDefinition[] = [
  {
    id: 'claude-md',
    fileName: 'CLAUDE.md',
    templateName: 'CLAUDE.MD',
    description: 'Root-level Claude Code project instructions.'
  },
  {
    id: 'behaviour-md',
    fileName: 'behaviour.md',
    description: 'Auto-loaded behavior rules for Claude Code.'
  },
  {
    id: 'skill-triggers-md',
    fileName: 'SKILL.md',
    targetPath: ['.claude', 'skills', 'SKILL.md'],
    backupFileName: 'SKILL.md-old',
    templateName: 'SKILL.md',
    description: 'Skill trigger notes for Claude Code.'
  },
  {
    id: 'memory-flush-md',
    fileName: 'memory-flush.md',
    description: 'Memory cleanup notes for Claude Code.'
  },
  {
    id: 'agents-md',
    fileName: 'agents.md',
    description: 'On-demand agent documentation for Claude Code.'
  },
  {
    id: 'context-safety-md',
    fileName: 'context-safety.md',
    description: 'Context safety documentation for Claude Code.'
  },
  {
    id: 'task-routing-md',
    fileName: 'task-routing.md',
    description: 'Task routing documentation for Claude Code.'
  },
  {
    id: 'behaviour-extended-md',
    fileName: 'behaviour-extended.md',
    description: 'Extended behavior documentation for Claude Code.'
  },
  {
    id: 'scaffolding-checkpoint-md',
    fileName: 'scaffolding-checkpoint.md',
    description: 'Scaffolding checkpoint documentation for Claude Code.'
  },
  {
    id: 'today-md',
    fileName: 'today.md',
    description: 'Hot context for today.'
  },
  {
    id: 'projects-md',
    fileName: 'projects.md',
    description: 'Hot context for projects.'
  },
  {
    id: 'goals-md',
    fileName: 'goals.md',
    description: 'Hot context for goals.'
  },
  {
    id: 'active-task-md',
    fileName: 'active-task.md',
    description: 'Hot context for the active task.'
  }
];

export class ClaudeResourcePanel {
  public static currentPanel: ClaudeResourcePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly extensionUri: vscode.Uri;
  private readonly fileSystemService: FileSystemService;

  public static createOrShow(extensionUri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ClaudeResourcePanel.currentPanel) {
      ClaudeResourcePanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'claudeResourcePanel',
      'Init Resource Claude',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ClaudeResourcePanel.currentPanel = new ClaudeResourcePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.fileSystemService = new FileSystemService();
    this.panel.webview.html = getClaudeResourceContent();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'installClaudeResources':
            await this.handleInstallClaudeResources(message.resources);
            break;
          case 'installClaudeMd':
            await this.handleInstallClaudeResources(['claude-md']);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public dispose(): void {
    ClaudeResourcePanel.currentPanel = undefined;
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }
  }

  private async handleInstallClaudeResources(resourceIds: unknown): Promise<void> {
    try {
      const selectedResourceIds = Array.isArray(resourceIds)
        ? resourceIds.filter((resourceId): resourceId is string => typeof resourceId === 'string')
        : [];
      const selectedResources = CLAUDE_RESOURCES.filter(resource => selectedResourceIds.includes(resource.id));

      if (selectedResources.length === 0) {
        vscode.window.showWarningMessage('AgentKit: Select at least one Claude resource to install');
        this.panel.webview.postMessage({ command: 'installClaudeResourcesFailed' });
        return;
      }

      const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('AgentKit: Please open a workspace folder first');
        this.panel.webview.postMessage({ command: 'installClaudeResourcesFailed' });
        return;
      }

      for (const resource of selectedResources) {
        await this.installClaudeResource(workspaceFolder, resource);
      }

      await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
      await vscode.commands.executeCommand('agentkit.refreshAgents');

      this.panel.webview.postMessage({ command: 'installClaudeResourcesComplete' });
      vscode.window.showInformationMessage(
        `AgentKit: Installed ${selectedResources.length} Claude ${selectedResources.length === 1 ? 'resource' : 'resources'} successfully`
      );
    } catch (error: any) {
      logger.error('Error installing Claude resources', error);
      vscode.window.showErrorMessage(`AgentKit Error: ${error.message}`);
      this.panel.webview.postMessage({ command: 'installClaudeResourcesFailed' });
    }
  }

  private async installClaudeResource(
    workspaceFolder: vscode.Uri,
    resource: ClaudeResourceDefinition
  ): Promise<void> {
    const targetPath = resource.targetPath ?? [resource.fileName];
    const targetDirectoryPath = targetPath.slice(0, -1);
    const targetFileName = targetPath[targetPath.length - 1];
    const backupFileName = resource.backupFileName ?? `${targetFileName}-OLD`;
    const targetUri = vscode.Uri.joinPath(workspaceFolder, ...targetPath);
    const backupUri = vscode.Uri.joinPath(workspaceFolder, ...targetDirectoryPath, backupFileName);
    const markdownContent = await this.readClaudeResourceContent(resource);

    if (targetDirectoryPath.length > 0) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceFolder, ...targetDirectoryPath));
    }

    if (await this.fileExists(targetUri)) {
      await vscode.workspace.fs.rename(targetUri, backupUri, { overwrite: true });
    }

    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(markdownContent, 'utf8'));
  }

  private async readClaudeResourceContent(resource: ClaudeResourceDefinition): Promise<string> {
    if (!resource.templateName) {
      return `# ${resource.fileName}\n\n${resource.description}\n`;
    }

    const possibleTemplateUris = [
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'execution', 'markdown', resource.templateName),
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'execution', 'markdown', resource.templateName),
      vscode.Uri.joinPath(this.extensionUri, 'execution', 'markdown', resource.templateName)
    ];

    for (const templateUri of possibleTemplateUris) {
      try {
        const content = await vscode.workspace.fs.readFile(templateUri);
        return Buffer.from(content).toString('utf8');
      } catch {
        continue;
      }
    }

    throw new Error(
      `Cannot read Claude resource template at ${path.join('src', 'webview', 'execution', 'markdown', resource.templateName)}`
    );
  }

  private async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }
}
