export function getStateScript(): string {
  return `
let currentView = 'list';
let currentMode = initialMode;
let currentItem = null;
let taskItems = [];
let listMessage = '';
let taskListFilter = {
  taskId: '',
  pending: true,
  success: true,
  doing: true,
  task: true,
  bug: true,
  analysis: true
};
let filterDialogState = {
  isOpen: false,
  taskId: '',
  pending: true,
  success: true,
  doing: true,
  task: true,
  bug: true,
  analysis: true,
  message: '',
  isError: false
};
let selectedNodeId = 'document';
let taskState = {
  mode: currentMode,
  items: [],
  projectFolder: '.project',
  documentsFolder: '',
  documents: [],
  nodes: [],
  workflows: []
};
let integrationState = {
  hasFigmaToken: false
};
let createFormState = {
  step: 1,
  type: modeToItemType(initialMode),
  id: '',
  workflowId: '',
  message: '',
  isError: false,
  isCreating: false
};
let figmaFormState = {
  activeTab: 'task-link',
  link: '',
  token: '',
  message: '',
  isError: false,
  isSyncing: false,
  highlightToken: false
};
let jiraFormState = {
  link: '',
  message: '',
  isError: false,
  isOpening: false,
  isReading: false
};
let markdownDialogState = {
  isOpen: false,
  mode: 'review',
  content: '',
  message: '',
  isError: false,
  isLoading: false,
  isSaving: false,
  isRunning: false,
  isRegenerating: false
};
let codeRunState = {
  isRunning: false,
  isError: false,
  message: '',
  markdownPath: ''
};

const modeCopy = {
  task: {
    documentTitle: 'Document',
    documentCopy: 'Import SRS, PDF, Office, text, or markdown files for the new task.'
  },
  'fix-bug': {
    documentTitle: 'Bug document',
    documentCopy: 'Import bug reports, reproduction notes, logs, screenshots converted by markitdown, or related markdown files.'
  },
  analysis: {
    documentTitle: 'Analysis document',
    documentCopy: 'Import research notes, requirements, logs, or source documents for the analysis.'
  }
};
  `;
}
