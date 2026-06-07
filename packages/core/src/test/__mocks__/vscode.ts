// Minimal vscode mock for unit tests

const fileStore = new Map<string, Buffer>();

const workspace = {
  fs: {
    readFile: jest.fn(async (uri: { fsPath: string }) => {
      const data = fileStore.get(uri.fsPath);
      if (!data) { throw new Error(`ENOENT: ${uri.fsPath}`); }
      return data;
    }),
    writeFile: jest.fn(async (uri: { fsPath: string }, content: Uint8Array) => {
      fileStore.set(uri.fsPath, Buffer.from(content));
    }),
    createDirectory: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined)
  },
  workspaceFolders: undefined
};

const Uri = {
  file: (path: string) => ({ fsPath: path, toString: () => path }),
  parse: (str: string) => ({ fsPath: str, toString: () => str }),
  joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
    fsPath: [base.fsPath, ...parts].join('/'),
    toString: () => [base.fsPath, ...parts].join('/')
  })
};

const TreeItem = class {
  constructor(public label: string) {}
};

const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
const ThemeIcon = class { constructor(public id: string) {} };
const EventEmitter = class {
  event = jest.fn();
  fire = jest.fn();
  dispose = jest.fn();
};

export function resetMockFs() {
  fileStore.clear();
}

export function seedMockFs(path: string, content: string) {
  fileStore.set(path, Buffer.from(content, 'utf8'));
}

export {
  workspace,
  Uri,
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  EventEmitter
};
