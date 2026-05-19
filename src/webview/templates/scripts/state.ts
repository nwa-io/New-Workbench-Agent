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
let deleteConfirmState = {
  isOpen: false,
  id: '',
  type: '',
  isDeleting: false
};
let selectedNodeId = 'document';
let selectedWorkflowStepKey = '';
let selectedWorkflowStep = null;
let taskTreeZoom = 1;
let detailModalState = {
  isOpen: false
};
let workflowRunState = {
  status: 'idle',
  pendingRun: false,
  message: '',
  errorTooltips: {}
};
let taskState = {
  mode: currentMode,
  items: [],
  currentWorkflow: undefined,
  projectFolder: '.project',
  documentsFolder: '',
  sourceDocuments: [],
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
  status: {
    running: false,
    connected: false,
    port: 8080,
    url: 'ws://localhost:8080'
  },
  items: [],
  receivedAt: '',
  fileName: '',
  fileKey: '',
  pageName: '',
  contextPath: '',
  message: '',
  isError: false,
  isLoading: false,
  hasRequestedState: false
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
