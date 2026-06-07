import * as vscode from 'vscode';
import {
  ComponentCategory,
  ComponentScannerService,
  ScannedComponent
} from '../services/ComponentScannerService';
import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';

const CATEGORY_ORDER: ComponentCategory[] = ['atom', 'molecule', 'organism', 'template', 'unknown'];

const CATEGORY_META: Record<ComponentCategory, { label: string; icon: string }> = {
  atom:     { label: 'Atoms',     icon: 'symbol-keyword' },
  molecule: { label: 'Molecules', icon: 'symbol-class' },
  organism: { label: 'Organisms', icon: 'symbol-interface' },
  template: { label: 'Templates', icon: 'symbol-namespace' },
  unknown:  { label: 'Other',     icon: 'symbol-misc' }
};

const FRAMEWORK_ICON: Record<string, string> = {
  vue: 'file-code',
  angular: 'file-code',
  react: 'file-code',
  svelte: 'file-code',
  unknown: 'file'
};

// Tree node types kept tiny — VS Code's TreeView walks the providers, so all
// the data we need to render and respond to commands hangs off the items
// themselves via well-typed properties.
type ScopeKind = 'paths-header' | 'path-row' | 'category' | 'component';

interface ScopeBase extends vscode.TreeItem {
  scope: ScopeKind;
}

export interface ComponentTreeItem extends ScopeBase {
  scope: 'component';
  component: ScannedComponent;
}

interface CategoryTreeItem extends ScopeBase {
  scope: 'category';
  category: ComponentCategory;
}

interface PathRowItem extends ScopeBase {
  scope: 'path-row';
  pathValue: string;
}

interface PathsHeaderItem extends ScopeBase {
  scope: 'paths-header';
}

type Node = ComponentTreeItem | CategoryTreeItem | PathRowItem | PathsHeaderItem;

export class ComponentBrowserProvider implements vscode.TreeDataProvider<Node> {
  private readonly _onDidChange = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private components: ScannedComponent[] = [];
  private scanning = false;

  constructor(
    private readonly scanner: ComponentScannerService,
    private readonly configService: ConfigService,
    private workspaceRoot: string | undefined
  ) {}

  setWorkspaceRoot(root: string | undefined): void {
    this.workspaceRoot = root;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.workspaceRoot) {
      this.components = [];
      this._onDidChange.fire();
      return;
    }
    if (this.scanning) {
      return;
    }
    this.scanning = true;
    try {
      const paths = this.configService.getComponentPaths();
      this.components = await this.scanner.scan(this.workspaceRoot, paths);
    } catch (error) {
      logger.error('Component scan failed', error as Error);
      this.components = [];
    } finally {
      this.scanning = false;
      this._onDidChange.fire();
    }
  }

  getComponents(): ScannedComponent[] {
    return this.components;
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Node): Node[] {
    if (!element) {
      return this.buildRoot();
    }
    if (element.scope === 'paths-header') {
      const paths = this.configService.getComponentPaths();
      if (paths.length === 0) {
        const empty: PathRowItem = {
          ...new vscode.TreeItem('No paths configured', vscode.TreeItemCollapsibleState.None),
          scope: 'path-row',
          pathValue: ''
        } as PathRowItem;
        empty.iconPath = new vscode.ThemeIcon('warning');
        empty.contextValue = 'componentPathEmpty';
        return [empty];
      }
      return paths.map(p => {
        const item: PathRowItem = {
          ...new vscode.TreeItem(p, vscode.TreeItemCollapsibleState.None),
          scope: 'path-row',
          pathValue: p
        } as PathRowItem;
        item.iconPath = new vscode.ThemeIcon('folder');
        item.contextValue = 'componentPath';
        item.tooltip = `Scan path · ${p}`;
        return item;
      });
    }
    if (element.scope === 'category') {
      const list = this.components.filter(c => c.category === element.category);
      return list.map(c => this.buildComponentItem(c));
    }
    return [];
  }

  private buildRoot(): Node[] {
    const items: Node[] = [];

    // Header row that holds the configured scan paths so users see what's
    // covered and can add/remove paths inline via the context menu.
    const pathsHeader: PathsHeaderItem = {
      ...new vscode.TreeItem(
        'Scan Paths',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      scope: 'paths-header'
    } as PathsHeaderItem;
    pathsHeader.iconPath = new vscode.ThemeIcon('list-tree');
    pathsHeader.contextValue = 'componentPaths';
    pathsHeader.description = `${this.configService.getComponentPaths().length} configured`;
    items.push(pathsHeader);

    if (!this.workspaceRoot) {
      const noWorkspace: PathRowItem = {
        ...new vscode.TreeItem('Open a workspace to scan components', vscode.TreeItemCollapsibleState.None),
        scope: 'path-row',
        pathValue: ''
      } as PathRowItem;
      noWorkspace.iconPath = new vscode.ThemeIcon('info');
      items.push(noWorkspace);
      return items;
    }

    if (this.components.length === 0) {
      const empty: PathRowItem = {
        ...new vscode.TreeItem(
          this.scanning ? 'Scanning…' : 'No components found — check Scan Paths',
          vscode.TreeItemCollapsibleState.None
        ),
        scope: 'path-row',
        pathValue: ''
      } as PathRowItem;
      empty.iconPath = new vscode.ThemeIcon(this.scanning ? 'loading~spin' : 'info');
      items.push(empty);
      return items;
    }

    for (const category of CATEGORY_ORDER) {
      const inCategory = this.components.filter(c => c.category === category);
      if (inCategory.length === 0) continue;
      const meta = CATEGORY_META[category];
      const item: CategoryTreeItem = {
        ...new vscode.TreeItem(
          `${meta.label}`,
          vscode.TreeItemCollapsibleState.Expanded
        ),
        scope: 'category',
        category
      } as CategoryTreeItem;
      item.iconPath = new vscode.ThemeIcon(meta.icon);
      item.description = `${inCategory.length}`;
      item.contextValue = `componentCategory:${category}`;
      items.push(item);
    }
    return items;
  }

  private buildComponentItem(c: ScannedComponent): ComponentTreeItem {
    const item: ComponentTreeItem = {
      ...new vscode.TreeItem(c.name, vscode.TreeItemCollapsibleState.None),
      scope: 'component',
      component: c
    } as ComponentTreeItem;
    item.description = c.filePath;
    item.tooltip = new vscode.MarkdownString(
      `**${c.name}** · ${c.framework}\n\n` +
      `path: \`${c.filePath}\`\n\n` +
      `category: ${c.category}\n\n` +
      `export: ${c.exportType}\n\n` +
      `lines: ${c.lineCount} · local imports: ${c.importCount}\n\n` +
      (c.propNames.length ? `props: ${c.propNames.join(', ')}` : '_no props detected_')
    );
    item.iconPath = new vscode.ThemeIcon(FRAMEWORK_ICON[c.framework] ?? 'file');
    item.contextValue = 'component';
    item.command = {
      command: 'nwa.components.openFile',
      title: 'Open',
      arguments: [item]
    };
    return item;
  }
}
