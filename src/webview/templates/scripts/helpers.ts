export function getHelpersScript(): string {
  return `
function getActiveItemType() {
  const item = currentItem || taskState.currentItem;
  return item ? item.type : modeToItemType(currentMode);
}

function getActiveModeCopy() {
  const activeType = getActiveItemType();

  if (activeType === 'bug') {
    return modeCopy['fix-bug'];
  }

  if (activeType === 'analysis') {
    return modeCopy.analysis;
  }

  return modeCopy[currentMode] || modeCopy.task;
}

function requestState() {
  vscode.postMessage({
    command: 'getTaskManagerState',
    data: getTaskRequestContext()
  });
}

function setMode(mode) {
  currentMode = mode;
  createFormState.type = modeToItemType(mode);
  updateModeControls();
  if (currentView === 'list') {
    renderListView();
  } else if (currentView === 'create') {
    renderCreateView();
  } else {
    renderDetail();
  }
  vscode.postMessage({
    command: 'setTaskMode',
    data: { mode }
  });
}

function updateModeControls() {
  const createButton = document.getElementById('taskCreateHeaderBtn');
  const filterButton = document.getElementById('taskFilterHeaderBtn');

  if (createButton) {
    createButton.hidden = currentView !== 'list';
  }

  if (filterButton) {
    filterButton.hidden = currentView !== 'list' || currentMode !== 'task';
    filterButton.classList.toggle('active', currentMode === 'task' && isTaskListFilterActive());
  }

  renderBreadcrumb();
}

function renderBreadcrumb() {
  const breadcrumb = document.getElementById('taskBreadcrumb');
  if (!breadcrumb) {
    return;
  }

  const parts = [
    {
      label: 'Task Manager',
      target: 'list'
    }
  ];

  if (currentView === 'create') {
    parts.push({
      label: 'Create',
      target: 'create'
    });
  } else if (currentView === 'detail' && currentItem) {
    parts.push({
      label: currentItem.id,
      target: 'detail'
    });
  }

  breadcrumb.innerHTML = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const separator = index > 0 ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : '';
    const button = '<button class="breadcrumb-link' + (isLast ? ' current' : '') + '" type="button" data-breadcrumb-target="' + escapeHtml(part.target) + '"' + (isLast ? ' aria-current="page"' : '') + '>' + escapeHtml(part.label) + '</button>';
    return separator + button;
  }).join('');

  breadcrumb.querySelectorAll('[data-breadcrumb-target]').forEach(button => {
    button.onclick = () => {
      const target = button.dataset.breadcrumbTarget;
      if (target === 'list') {
        showListView();
      } else if (target === 'detail' && currentItem) {
        showView('detail');
      } else if (target === 'create') {
        showView('create');
      }
    };
  });
}

function modeToItemType(mode) {
  if (mode === 'fix-bug') {
    return 'bug';
  }

  return mode === 'analysis' ? 'analysis' : 'task';
}

function itemTypeToMode(type) {
  if (type === 'bug' || type === 'task') {
    return 'task';
  }

  return type === 'analysis' ? 'analysis' : 'task';
}

function itemTypeLabel(type) {
  if (type === 'bug') {
    return 'Bug';
  }

  return type === 'analysis' ? 'Analysis' : 'Task';
}

function itemTypePluralLabel(type) {
  return type === 'analysis' ? 'Analysis items' : itemTypeLabel(type) + 's';
}

function itemTypeText(type) {
  return itemTypeLabel(type).toLowerCase();
}

function getTaskRequestContext(extra = {}) {
  const item = currentItem || taskState.currentItem;
  return Object.assign({
    mode: currentMode,
    itemId: item ? item.id : undefined,
    itemType: item ? item.type : undefined
  }, extra);
}

function showView(view) {
  currentView = view;
  renderShellViews();
}

function renderShellViews() {
  document.getElementById('taskListView').hidden = currentView !== 'list';
  document.getElementById('taskCreateView').hidden = currentView !== 'create';
  document.getElementById('taskDetailView').hidden = currentView !== 'detail';
  updateModeControls();

  if (currentView === 'list') {
    renderListView();
  } else if (currentView === 'create') {
    renderCreateView();
  } else {
    renderTree();
    renderDetail();
  }
}

function statusClass(status) {
  return String(status).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyTaskState(nextState, keepListItem = false) {
  taskState = nextState || taskState;
  taskItems = Array.isArray(taskState.items) ? taskState.items : [];
  taskState.workflows = Array.isArray(taskState.workflows) ? taskState.workflows : [];
  currentMode = taskState.mode || currentMode;
  if (currentView === 'create') {
    ensureCreateWorkflowSelection();
  }

  if (taskState.currentItem) {
    currentItem = taskState.currentItem;
  } else if (!keepListItem && currentView !== 'detail') {
    currentItem = null;
  }

  updateDocumentsFolderLabel();
  updateModeControls();
}

function updateDocumentsFolderLabel() {
  const label = document.getElementById('taskDocumentsFolder');
  if (label) {
    const itemText = currentItem ? ' - ' + currentItem.folderPath : '';
    label.textContent = 'Documents: ' + (taskState.documentsFolder || '-') + itemText;
  }
}

function refreshDetailView() {
  renderTree();
  renderDetail();
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
  `;
}
