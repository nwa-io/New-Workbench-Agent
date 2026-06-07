import * as vscode from 'vscode';
import * as path from 'path';
import { renderWebviewHtml, webviewLocalResourceRoots } from './webviewHtml';
import { ClaudeResourceHostMessage, ClaudeResourceLayer, ClaudeResourceWebviewMessage } from './protocol';
import { FileSystemService } from '../services/FileSystemService';
import { logger } from '../utils/logger';

interface ClaudeResourceDefinition {
  id: string;
  fileName: string;
  /** Display name shown on the checkbox in the webview. */
  label: string;
  /** Layer group the resource appears under (1-based). */
  layer: number;
  targetPath?: string[];
  backupFileName?: string;
  templateName?: string;
  description: string;
}

const CLAUDE_RESOURCE_LAYERS: ClaudeResourceLayer[] = [
  { layer: 1, title: 'Layer 1', name: 'Auto-loaded Rules' },
  { layer: 2, title: 'Layer 2', name: 'On-demand Docs' },
  { layer: 3, title: 'Layer 3', name: 'hot Data' }
];

const CLAUDE_RESOURCES: ClaudeResourceDefinition[] = [
  {
    id: 'claude-md',
    fileName: 'CLAUDE.md',
    label: 'claude.md',
    layer: 1,
    templateName: 'CLAUDE.md',
    description: 'Root-level Claude Code project instructions.'
  },
  {
    id: 'behaviour-md',
    fileName: 'behaviour.md',
    label: 'behaviour.md',
    layer: 1,
    description: 'Auto-loaded behavior rules for Claude Code.'
  },
  {
    id: 'skill-triggers-md',
    fileName: 'SKILL.md',
    label: 'SKILL.md',
    layer: 1,
    targetPath: ['.claude', 'skills', 'SKILL.md'],
    backupFileName: 'SKILL.md-old',
    templateName: 'SKILL.md',
    description: 'Skill trigger notes for Claude Code.'
  },
  {
    id: 'memory-flush-md',
    fileName: 'memory-flush.md',
    label: 'memory-flush.md',
    layer: 1,
    description: 'Memory cleanup notes for Claude Code.'
  },
  {
    id: 'agents-md',
    fileName: 'agents.md',
    label: 'agents.md',
    layer: 2,
    description: 'On-demand agent documentation for Claude Code.'
  },
  {
    id: 'context-safety-md',
    fileName: 'context-safety.md',
    label: 'context-safety.md',
    layer: 2,
    description: 'Context safety documentation for Claude Code.'
  },
  {
    id: 'task-routing-md',
    fileName: 'task-routing.md',
    label: 'task-routing.md',
    layer: 2,
    description: 'Task routing documentation for Claude Code.'
  },
  {
    id: 'behaviour-extended-md',
    fileName: 'behaviour-extended.md',
    label: 'behaviour-extended.md',
    layer: 2,
    description: 'Extended behavior documentation for Claude Code.'
  },
  {
    id: 'scaffolding-checkpoint-md',
    fileName: 'scaffolding-checkpoint.md',
    label: 'scaffolding-checkpoint.md',
    layer: 2,
    description: 'Scaffolding checkpoint documentation for Claude Code.'
  },
  {
    id: 'today-md',
    fileName: 'today.md',
    label: 'today.md',
    layer: 3,
    description: 'Hot context for today.'
  },
  {
    id: 'projects-md',
    fileName: 'projects.md',
    label: 'projects.md',
    layer: 3,
    description: 'Hot context for projects.'
  },
  {
    id: 'goals-md',
    fileName: 'goals.md',
    label: 'goals.md',
    layer: 3,
    description: 'Hot context for goals.'
  },
  {
    id: 'active-task-md',
    fileName: 'active-task.md',
    label: 'active-task.md',
    layer: 3,
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
      'Skills selection',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: webviewLocalResourceRoots(extensionUri)
      }
    );

    ClaudeResourcePanel.currentPanel = new ClaudeResourcePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.fileSystemService = new FileSystemService();
    this.panel.webview.html = renderWebviewHtml({
      webview: this.panel.webview,
      extensionUri,
      bundle: 'claudeResource',
      title: 'Claude Resource Manager'
    });
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      async (message: ClaudeResourceWebviewMessage) => {
        switch (message.command) {
          case 'ready':
            this.postCatalog();
            break;
          case 'installClaudeResources':
            await this.handleInstallClaudeResources(message.resources);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private postCatalog(): void {
    const message: ClaudeResourceHostMessage = {
      command: 'claudeResourceCatalog',
      data: {
        layers: CLAUDE_RESOURCE_LAYERS,
        resources: CLAUDE_RESOURCES.map(({ id, label, layer }) => ({ id, label, layer }))
      }
    };
    this.panel.webview.postMessage(message);
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
        vscode.window.showWarningMessage('NWA: Select at least one Claude resource to install');
        this.panel.webview.postMessage({ command: 'installClaudeResourcesFailed' });
        return;
      }

      const workspaceFolder = await this.fileSystemService.getWorkspaceFolder();
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('NWA: Please open a workspace folder first');
        this.panel.webview.postMessage({ command: 'installClaudeResourcesFailed' });
        return;
      }

      for (const resource of selectedResources) {
        await this.installClaudeResource(workspaceFolder, resource);
      }

      await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');

      this.panel.webview.postMessage({ command: 'installClaudeResourcesComplete' });
      vscode.window.showInformationMessage(
        `NWA: Installed ${selectedResources.length} Claude ${selectedResources.length === 1 ? 'resource' : 'resources'} successfully`
      );
    } catch (error: any) {
      logger.error('Error installing Claude resources', error);
      vscode.window.showErrorMessage(`NWA Error: ${error.message}`);
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
