import * as path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger';

export type ComponentCategory = 'atom' | 'molecule' | 'organism' | 'template' | 'unknown';
export type ComponentFramework = 'vue' | 'angular' | 'react' | 'svelte' | 'unknown';

export interface ScannedComponent {
  name: string;
  filePath: string;
  absolutePath: string;
  framework: ComponentFramework;
  exportType: 'default' | 'named';
  category: ComponentCategory;
  importCount: number;
  lineCount: number;
  propNames: string[];
}

const ATOM_FOLDERS = ['atom', 'atoms', 'base', 'ui', 'primitive', 'primitives', 'elements'];
const MOLECULE_FOLDERS = ['molecule', 'molecules', 'compound', 'composite'];
const ORGANISM_FOLDERS = ['organism', 'organisms', 'block', 'blocks', 'section', 'sections', 'feature'];
const TEMPLATE_FOLDERS = ['template', 'templates', 'layout', 'layouts', 'page', 'pages'];

const ATOM_NAME_PATTERNS: RegExp[] = [
  /^(Base|App|Common|Ui|UI)?(Button|Btn|IconButton|Input|TextField|TextInput|Field|Label|Icon|Badge|Tag|Chip|Avatar|Spinner|Loader|Tooltip|Toggle|Switch|Checkbox|Radio|Select|Dropdown|Link|Text|Heading|Title|Divider|Separator|Image|Img|Skeleton|Pill|Dot|Indicator|Status|Alert|Toast|Tag|Pill)$/i
];

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.angular',
  'dist',
  'build',
  'out',
  '__tests__',
  '__mocks__',
  '__fixtures__',
  'coverage',
  '.cache',
  '.turbo',
  '.vite',
  '.parcel-cache'
]);

const TEST_FILE_RE = /\.(test|spec|stories?)\.(t|j)sx?$/i;

const MAX_FILES_PER_RUN = 1000;

// Scans the workspace for frontend components and labels each one as
// atom / molecule / organism using folder, name, and complexity heuristics.
// The output drives:
//   - The Component Browser sidebar tree (sorted by category)
//   - The COMPONENT_CATALOG message sent to the Figma plugin (drives Auto-fill)
export class ComponentScannerService {
  async detectFramework(workspaceRoot: string): Promise<ComponentFramework> {
    try {
      const pkgPath = path.join(workspaceRoot, 'package.json');
      const raw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      const deps: Record<string, string> = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.peerDependencies ?? {})
      };
      if (deps['vue'] || deps['@vue/core'] || deps['@vue/runtime-core']) {
        return 'vue';
      }
      if (deps['@angular/core']) {
        return 'angular';
      }
      if (deps['svelte']) {
        return 'svelte';
      }
      if (deps['react']) {
        return 'react';
      }
    } catch {
      /* package.json not found or unreadable */
    }
    return 'unknown';
  }

  async scan(workspaceRoot: string, componentPaths: string[]): Promise<ScannedComponent[]> {
    if (!workspaceRoot) {
      return [];
    }
    const framework = await this.detectFramework(workspaceRoot);
    const found: ScannedComponent[] = [];
    let budget = MAX_FILES_PER_RUN;

    for (const relPath of componentPaths) {
      if (budget <= 0) {
        break;
      }
      const absPath = path.join(workspaceRoot, relPath);
      try {
        const stat = await fs.stat(absPath);
        if (!stat.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }
      try {
        budget = await this.scanDirectory(absPath, workspaceRoot, framework, found, budget);
      } catch (error) {
        logger.warn(`Component scan failed for ${absPath}: ${(error as Error).message}`);
      }
    }

    return this.dedupe(found);
  }

  private async scanDirectory(
    dirPath: string,
    workspaceRoot: string,
    framework: ComponentFramework,
    out: ScannedComponent[],
    budget: number
  ): Promise<number> {
    if (budget <= 0) {
      return budget;
    }

    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return budget;
    }

    for (const entry of entries) {
      if (budget <= 0) {
        break;
      }
      if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        budget = await this.scanDirectory(full, workspaceRoot, framework, out, budget);
      } else if (entry.isFile() && this.isComponentFile(entry.name, framework)) {
        budget -= 1;
        const parsed = await this.parseFile(full, workspaceRoot, framework);
        if (parsed) {
          out.push(parsed);
        }
      }
    }
    return budget;
  }

  private isComponentFile(filename: string, framework: ComponentFramework): boolean {
    if (TEST_FILE_RE.test(filename)) {
      return false;
    }
    if (filename.endsWith('.d.ts')) {
      return false;
    }
    if (framework === 'vue') {
      return filename.endsWith('.vue');
    }
    if (framework === 'angular') {
      return filename.endsWith('.component.ts');
    }
    if (framework === 'svelte') {
      return filename.endsWith('.svelte');
    }
    if (framework === 'react') {
      return filename.endsWith('.tsx') || filename.endsWith('.jsx');
    }
    return (
      filename.endsWith('.vue') ||
      filename.endsWith('.svelte') ||
      filename.endsWith('.tsx') ||
      filename.endsWith('.jsx') ||
      filename.endsWith('.component.ts')
    );
  }

  private async parseFile(
    filePath: string,
    workspaceRoot: string,
    fallbackFramework: ComponentFramework
  ): Promise<ScannedComponent | null> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
    const lineCount = content.split(/\r?\n/).length;
    const filename = path.basename(filePath);
    const dirName = path.basename(path.dirname(filePath)).toLowerCase();

    const framework = this.detectFileFramework(filename, fallbackFramework);
    const name = this.extractComponentName(filename, content, framework);
    if (!name) {
      return null;
    }

    const localImportMatches = content.match(/from\s+['"]\.\.?\//g);
    const importCount = localImportMatches ? localImportMatches.length : 0;
    const isDefaultExport = /export\s+default/.test(content);
    const exportType: 'default' | 'named' = isDefaultExport ? 'default' : 'named';
    const propNames = this.extractProps(content, framework);
    const category = this.classify(dirName, name, importCount, lineCount);

    return {
      name,
      filePath: path.relative(workspaceRoot, filePath).replace(/\\/g, '/'),
      absolutePath: filePath,
      framework,
      exportType,
      category,
      importCount,
      lineCount,
      propNames
    };
  }

  private detectFileFramework(filename: string, fallback: ComponentFramework): ComponentFramework {
    if (filename.endsWith('.vue')) return 'vue';
    if (filename.endsWith('.svelte')) return 'svelte';
    if (filename.endsWith('.component.ts')) return 'angular';
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return 'react';
    return fallback;
  }

  private extractComponentName(filename: string, content: string, framework: ComponentFramework): string | null {
    if (framework === 'vue') {
      const optionName = content.match(/\bname:\s*['"`]([^'"`]+)['"`]/);
      if (optionName) {
        return this.toPascalCase(optionName[1]);
      }
      return this.toPascalCase(path.basename(filename, '.vue'));
    }
    if (framework === 'angular') {
      const cls = content.match(/export\s+class\s+([A-Z][\w]*)/);
      if (cls) {
        return cls[1].replace(/Component$/, '');
      }
      return this.toPascalCase(path.basename(filename, '.component.ts'));
    }
    if (framework === 'svelte') {
      return this.toPascalCase(path.basename(filename, '.svelte'));
    }
    // react / generic
    const reactMatchers: RegExp[] = [
      /export\s+default\s+function\s+([A-Z][\w]*)/,
      /export\s+default\s+class\s+([A-Z][\w]*)/,
      /export\s+(?:const|function|class)\s+([A-Z][\w]*)/,
      /const\s+([A-Z][\w]*)\s*=\s*\(?[^)]*\)?\s*=>/,
      /function\s+([A-Z][\w]*)\s*\(/
    ];
    for (const re of reactMatchers) {
      const m = content.match(re);
      if (m) {
        return m[1];
      }
    }
    return this.toPascalCase(path.basename(filename, path.extname(filename)));
  }

  private extractProps(content: string, framework: ComponentFramework): string[] {
    const props = new Set<string>();
    if (framework === 'vue') {
      const propsBlock = content.match(/defineProps[<(]\s*([\s\S]*?)\s*[>)]\s*\(/);
      if (propsBlock) {
        const keys = propsBlock[1].match(/(\w+)\s*[?:]/g);
        keys?.forEach(k => props.add(k.replace(/[?:].*$/, '').trim()));
      }
      const optionsBlock = content.match(/props\s*:\s*\{([\s\S]*?)\}/);
      if (optionsBlock) {
        const keys = optionsBlock[1].match(/^\s*(\w+)\s*:/gm);
        keys?.forEach(k => props.add(k.replace(':', '').trim()));
      }
    } else if (framework === 'angular') {
      const inputs = content.match(/@Input\(\s*[^)]*\)\s*(\w+)/g);
      inputs?.forEach(m => {
        const name = m.replace(/@Input\(\s*[^)]*\)\s*/, '').trim();
        if (name) props.add(name);
      });
    } else {
      const interfaceMatch = content.match(/interface\s+\w*Props\s*\{([\s\S]*?)\}/);
      if (interfaceMatch) {
        const keys = interfaceMatch[1].match(/^\s*(\w+)\s*[?:]/gm);
        keys?.forEach(k => props.add(k.replace(/[?:].*$/, '').trim()));
      }
      const typeMatch = content.match(/type\s+\w*Props\s*=\s*\{([\s\S]*?)\}/);
      if (typeMatch) {
        const keys = typeMatch[1].match(/^\s*(\w+)\s*[?:]/gm);
        keys?.forEach(k => props.add(k.replace(/[?:].*$/, '').trim()));
      }
    }
    return Array.from(props).filter(Boolean);
  }

  private classify(
    dirName: string,
    name: string,
    importCount: number,
    lineCount: number
  ): ComponentCategory {
    const dirLower = dirName.toLowerCase();

    if (ATOM_FOLDERS.some(p => dirLower === p || dirLower.includes(p))) {
      return 'atom';
    }
    if (MOLECULE_FOLDERS.some(p => dirLower === p || dirLower.includes(p))) {
      return 'molecule';
    }
    if (ORGANISM_FOLDERS.some(p => dirLower === p || dirLower.includes(p))) {
      return 'organism';
    }
    if (TEMPLATE_FOLDERS.some(p => dirLower === p || dirLower.includes(p))) {
      return 'template';
    }

    if (ATOM_NAME_PATTERNS.some(re => re.test(name))) {
      return 'atom';
    }

    if (importCount === 0 && lineCount < 80) {
      return 'atom';
    }
    if (importCount <= 2 && lineCount < 200) {
      return 'molecule';
    }
    if (importCount > 4 || lineCount > 250) {
      return 'organism';
    }
    return 'unknown';
  }

  private toPascalCase(input: string): string {
    return input
      .replace(/[^A-Za-z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  private dedupe(list: ScannedComponent[]): ScannedComponent[] {
    const seen = new Set<string>();
    const result: ScannedComponent[] = [];
    for (const c of list) {
      const key = `${c.framework}::${c.name}::${c.filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(c);
    }
    return result.sort((a, b) => {
      if (a.category !== b.category) {
        return categoryOrder(a.category) - categoryOrder(b.category);
      }
      return a.name.localeCompare(b.name);
    });
  }
}

function categoryOrder(c: ComponentCategory): number {
  return ({ atom: 0, molecule: 1, organism: 2, template: 3, unknown: 4 } as const)[c];
}
