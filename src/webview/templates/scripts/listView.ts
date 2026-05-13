export function getListViewScript(): string {
  return `
function renderListView() {
  const list = document.getElementById('taskItemList');
  const status = document.getElementById('taskListStatus');
  const activeType = modeToItemType(currentMode);
  const visibleItems = getVisibleTaskItems();

  if (status) {
    status.textContent = listMessage || '';
    status.hidden = !listMessage;
  }

  list.innerHTML = visibleItems.length > 0
    ? visibleItems.map(item => getTaskItemCardHtml(item)).join('')
    : '<p class="empty-state">No ' + getEmptyListLabel(activeType) + ' created yet.</p>';

  updateModeControls();
  renderTaskFilterChips();
  bindTaskItemList();
}

function getVisibleTaskItems() {
  const items = taskItems || [];

  if (currentMode === 'task') {
    return items.filter(item => {
      if (item.type !== 'task' && item.type !== 'bug' && item.type !== 'analysis') {
        return false;
      }

      if (!taskListFilter[item.type]) {
        return false;
      }

      if (taskListFilter.taskId && !String(item.id || '').toLowerCase().includes(taskListFilter.taskId.toLowerCase())) {
        return false;
      }

      return Boolean(taskListFilter[getTaskProgressStatus(item)]);
    });
  }

  const activeType = modeToItemType(currentMode);
  return items.filter(item => item.type === activeType);
}

function getEmptyListLabel(activeType) {
  if (currentMode === 'task' && isTaskListFilterActive()) {
    return 'items matching this filter';
  }

  return currentMode === 'task'
    ? 'tasks, bugs, or analysis items'
    : itemTypePluralLabel(activeType).toLowerCase();
}

function getTaskItemCardHtml(item) {
  const updatedAt = item.updatedAt ? formatDateTime(item.updatedAt) : '-';
  const summary = normalizeTaskItemSummary(item.summary);
  const progressPercent = Math.max(0, Math.min(100, Number(summary.progressPercent) || 0));
  const progressStatus = getTaskProgressStatus(item);
  const progressColor = summary.error
    ? '#f85149'
    : summary.warning
      ? '#d29922'
      : progressPercent >= 100
        ? '#22c55e'
        : '#2f81f7';
  const statusParts = [
    item.hasJira ? 'Jira' : null,
    item.hasFigmaCache ? 'Figma' : null,
    item.hasMarkdown ? 'Markdown' : null
  ].filter(Boolean);
  const statusText = statusParts.length > 0 ? statusParts.join(', ') : 'No synced data';
  const workflowText = summary.workflowName ? ' - ' + summary.workflowName : '';
  const issueHtml = summary.error
    ? '<div class="task-item-issue error">' + escapeHtml(summary.error) + '</div>'
    : summary.warning
      ? '<div class="task-item-issue warning">' + escapeHtml(summary.warning) + '</div>'
      : '';

  return '<div class="task-item-card' + (summary.error ? ' has-error' : summary.warning ? ' has-warning' : '') + '" style="--task-progress: ' + progressPercent + '%; --task-progress-color: ' + progressColor + ';" role="button" tabindex="0" data-open-task-item data-item-id="' + escapeHtml(item.id) + '" data-item-type="' + escapeHtml(item.type) + '">' +
    '<div class="task-item-main">' +
      '<div class="task-item-title">' +
        '<span class="status-badge status-ready">' + escapeHtml(itemTypeLabel(item.type)) + '</span>' +
        '<span class="task-item-name">' + escapeHtml(item.id) + '</span>' +
      '</div>' +
      '<div class="task-item-meta">Updated: ' + escapeHtml(updatedAt) + ' - ' + escapeHtml(statusText) + escapeHtml(workflowText) + '</div>' +
      '<div class="task-item-summary-row">' +
        '<span class="task-summary-chip">Status ' + escapeHtml(getTaskProgressStatusLabel(progressStatus)) + '</span>' +
        '<span class="task-summary-chip">Usage ' + escapeHtml(formatTokenCount(summary.usageTokens)) + '</span>' +
        '<span class="task-summary-chip">Current ' + escapeHtml(summary.currentFeature || 'Ready') + '</span>' +
      '</div>' +
      '<div class="task-item-progress" aria-label="Progress ' + progressPercent + ' percent">' +
        '<span class="task-item-progress-track"><span class="task-item-progress-fill" style="width: ' + progressPercent + '%;"></span></span>' +
        '<span class="task-item-progress-label">' + progressPercent + '%</span>' +
      '</div>' +
      issueHtml +
      '<div class="task-item-paths">' + escapeHtml(item.folderPath) + '</div>' +
    '</div>' +
    '<div class="task-item-actions">' +
      '<button class="icon-button danger" type="button" title="Delete ' + escapeHtml(item.id) + '" aria-label="Delete ' + escapeHtml(itemTypeText(item.type)) + ' ' + escapeHtml(item.id) + '" data-delete-task-item data-item-id="' + escapeHtml(item.id) + '" data-item-type="' + escapeHtml(item.type) + '">' + getTrashIconHtml() + '</button>' +
    '</div>' +
  '</div>';
}

function normalizeTaskItemSummary(summary) {
  const cleanSummary = summary || {};
  return {
    usageTokens: Math.max(0, Number(cleanSummary.usageTokens) || 0),
    progressPercent: Math.max(0, Math.min(100, Number(cleanSummary.progressPercent) || 0)),
    completedFeatureCount: Math.max(0, Number(cleanSummary.completedFeatureCount) || 0),
    totalFeatureCount: Math.max(0, Number(cleanSummary.totalFeatureCount) || 0),
    currentFeature: cleanSummary.currentFeature || 'Ready',
    warning: cleanSummary.warning || '',
    error: cleanSummary.error || '',
    workflowName: cleanSummary.workflowName || ''
  };
}

function getTaskProgressStatus(item) {
  const summary = normalizeTaskItemSummary(item ? item.summary : null);
  const progressPercent = Math.max(0, Math.min(100, Number(summary.progressPercent) || 0));

  if (progressPercent >= 100) {
    return 'success';
  }

  if (progressPercent > 0) {
    return 'doing';
  }

  return 'pending';
}

function getTaskProgressStatusLabel(status) {
  if (status === 'success') {
    return 'Success';
  }

  if (status === 'doing') {
    return 'On-job doing';
  }

  return 'Pending';
}

function formatTokenCount(value) {
  const tokens = Math.max(0, Number(value) || 0);
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(tokens >= 10000000 ? 0 : 1).replace(/\\.0$/, '') + 'm tokens';
  }

  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1).replace(/\\.0$/, '') + 'k tokens';
  }

  return tokens + ' tokens';
}

function getTrashIconHtml() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M3 6h18"></path>' +
    '<path d="M8 6V4h8v2"></path>' +
    '<path d="M6 6l1 14h10l1-14"></path>' +
    '<path d="M10 11v6"></path>' +
    '<path d="M14 11v6"></path>' +
  '</svg>';
}

function bindTaskItemList() {
  document.querySelectorAll('.task-item-card[data-open-task-item]').forEach(card => {
    card.onclick = event => {
      if (isDeleteEventTarget(event.target)) {
        return;
      }

      selectTaskItem(card.dataset.itemId, card.dataset.itemType);
    };
    card.onkeydown = event => {
      if (isDeleteEventTarget(event.target)) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectTaskItem(card.dataset.itemId, card.dataset.itemType);
      }
    };
  });

  document.querySelectorAll('[data-delete-task-item]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      deleteTaskItem(button.dataset.itemId, button.dataset.itemType);
    };
  });
}

function isDeleteEventTarget(target) {
  return Boolean(target && typeof target.closest === 'function' && target.closest('[data-delete-task-item]'));
}

function openTaskFilterDialog() {
  filterDialogState.isOpen = true;
  filterDialogState.taskId = taskListFilter.taskId;
  filterDialogState.pending = taskListFilter.pending;
  filterDialogState.success = taskListFilter.success;
  filterDialogState.doing = taskListFilter.doing;
  filterDialogState.task = taskListFilter.task;
  filterDialogState.bug = taskListFilter.bug;
  filterDialogState.analysis = taskListFilter.analysis;
  filterDialogState.message = '';
  filterDialogState.isError = false;
  renderTaskFilterDialog();
}

function closeTaskFilterDialog() {
  filterDialogState.isOpen = false;
  renderTaskFilterDialog();
}

function applyTaskFilterDialog() {
  if (!filterDialogState.pending && !filterDialogState.success && !filterDialogState.doing) {
    filterDialogState.message = 'Select at least one status.';
    filterDialogState.isError = true;
    renderTaskFilterDialog();
    return;
  }

  if (!filterDialogState.task && !filterDialogState.bug && !filterDialogState.analysis) {
    filterDialogState.message = 'Select at least one category.';
    filterDialogState.isError = true;
    renderTaskFilterDialog();
    return;
  }

  taskListFilter = {
    taskId: String(filterDialogState.taskId || '').trim(),
    pending: Boolean(filterDialogState.pending),
    success: Boolean(filterDialogState.success),
    doing: Boolean(filterDialogState.doing),
    task: Boolean(filterDialogState.task),
    bug: Boolean(filterDialogState.bug),
    analysis: Boolean(filterDialogState.analysis)
  };
  filterDialogState.isOpen = false;
  listMessage = '';
  renderTaskFilterDialog();
  renderListView();
}

function isTaskListFilterActive() {
  return Boolean(
    taskListFilter.taskId ||
    !taskListFilter.pending ||
    !taskListFilter.success ||
    !taskListFilter.doing ||
    !taskListFilter.task ||
    !taskListFilter.bug ||
    !taskListFilter.analysis
  );
}

function renderTaskFilterChips() {
  const chipContainer = document.getElementById('taskFilterChips');
  if (!chipContainer) {
    return;
  }

  if (currentMode !== 'task') {
    chipContainer.hidden = true;
    chipContainer.innerHTML = '';
    return;
  }

  const chips = getTaskFilterChips();
  chipContainer.hidden = chips.length === 0;
  chipContainer.innerHTML = chips.map(chip => {
    return '<span class="task-filter-chip">' +
      getFilterLeadingIconHtml(chip) +
      '<span class="task-filter-chip-title">' + escapeHtml(chip.title) + '</span>' +
      '<button class="task-filter-chip-remove" type="button" title="Remove ' + escapeHtml(chip.title) + '" aria-label="Remove ' + escapeHtml(chip.title) + '" data-filter-chip-kind="' + escapeHtml(chip.kind) + '" data-filter-chip-value="' + escapeHtml(chip.value || '') + '">' +
        getFilterRemoveIconHtml() +
      '</button>' +
    '</span>';
  }).join('');

  bindTaskFilterChips();
}

function getTaskFilterChips() {
  const chips = [];

  if (taskListFilter.taskId) {
    chips.push({
      kind: 'taskId',
      value: '',
      title: 'Task ID: ' + taskListFilter.taskId
    });
  }

  getTaskStatusFilterKeys().forEach(status => {
    if (taskListFilter[status]) {
      chips.push({
        kind: 'status',
        value: status,
        title: getTaskProgressStatusLabel(status)
      });
    }
  });

  getTaskCategoryFilterKeys().forEach(category => {
    if (taskListFilter[category]) {
      chips.push({
        kind: 'category',
        value: category,
        title: itemTypeLabel(category)
      });
    }
  });

  return chips;
}

function getFilterLeadingIconHtml(chip) {
  return '<span class="task-filter-chip-leading ' + escapeHtml(getFilterLeadingIconClass(chip)) + '" aria-hidden="true">' +
    getFilterLeadingIconSvg(chip) +
  '</span>';
}

function getFilterLeadingIconClass(chip) {
  if (chip.kind === 'taskId') {
    return 'task-id';
  }

  return chip.kind + '-' + chip.value;
}

function getFilterLeadingIconSvg(chip) {
  if (chip.kind === 'taskId') {
    return '<svg viewBox="0 0 24 24"><path d="M9 3L7 21"></path><path d="M17 3l-2 18"></path><path d="M4 8h17"></path><path d="M3 16h17"></path></svg>';
  }

  if (chip.kind === 'status' && chip.value === 'success') {
    return '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>';
  }

  if (chip.kind === 'status' && chip.value === 'doing') {
    return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>';
  }

  if (chip.kind === 'status' && chip.value === 'pending') {
    return '<svg viewBox="0 0 24 24"><path d="M12 7v5l3 3"></path><path d="M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0z"></path></svg>';
  }

  if (chip.kind === 'category' && chip.value === 'analysis') {
    return '<svg viewBox="0 0 24 24"><path d="M4 19h16"></path><path d="M7 16l4-8l3 5l3-7"></path></svg>';
  }

  if (chip.kind === 'category' && chip.value === 'bug') {
    return '<svg viewBox="0 0 24 24"><path d="M8 8h8v10a4 4 0 0 1-8 0z"></path><path d="M9 4l2 4"></path><path d="M15 4l-2 4"></path><path d="M4 13h4"></path><path d="M16 13h4"></path><path d="M5 20l3-3"></path><path d="M19 20l-3-3"></path></svg>';
  }

  return '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>';
}

function getFilterRemoveIconHtml() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M18 6L6 18"></path>' +
    '<path d="M6 6l12 12"></path>' +
  '</svg>';
}

function bindTaskFilterChips() {
  document.querySelectorAll('[data-filter-chip-kind]').forEach(button => {
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      removeTaskFilterChip(button.dataset.filterChipKind, button.dataset.filterChipValue);
    };
  });
}

function removeTaskFilterChip(kind, value) {
  if (kind === 'taskId') {
    taskListFilter.taskId = '';
  } else if (kind === 'status' && getTaskStatusFilterKeys().includes(value)) {
    if (getSelectedTaskStatusCount() <= 1) {
      setAllTaskStatuses(true);
    } else {
      taskListFilter[value] = false;
    }
  } else if (kind === 'category' && getTaskCategoryFilterKeys().includes(value)) {
    if (getSelectedTaskCategoryCount() <= 1) {
      setAllTaskCategories(true);
    } else {
      taskListFilter[value] = false;
    }
  }

  listMessage = '';
  renderListView();
}

function getTaskStatusFilterKeys() {
  return ['pending', 'doing', 'success'];
}

function getTaskCategoryFilterKeys() {
  return ['task', 'bug', 'analysis'];
}

function areAllTaskStatusesSelected() {
  return getTaskStatusFilterKeys().every(status => Boolean(taskListFilter[status]));
}

function areAllTaskCategoriesSelected() {
  return getTaskCategoryFilterKeys().every(category => Boolean(taskListFilter[category]));
}

function getSelectedTaskStatusCount() {
  return getTaskStatusFilterKeys().filter(status => Boolean(taskListFilter[status])).length;
}

function getSelectedTaskCategoryCount() {
  return getTaskCategoryFilterKeys().filter(category => Boolean(taskListFilter[category])).length;
}

function setAllTaskStatuses(selected) {
  getTaskStatusFilterKeys().forEach(status => {
    taskListFilter[status] = selected;
  });
}

function setAllTaskCategories(selected) {
  getTaskCategoryFilterKeys().forEach(category => {
    taskListFilter[category] = selected;
  });
}

function renderTaskFilterDialog() {
  const existingDialog = document.getElementById('taskFilterDialog');
  if (!filterDialogState.isOpen) {
    if (existingDialog) {
      existingDialog.remove();
    }
    return;
  }

  const dialogHtml = \`
    <div class="filter-dialog-backdrop" id="taskFilterDialog">
      <div class="filter-dialog" role="dialog" aria-modal="true" aria-label="Filter task list">
        <div class="filter-dialog-header">
          <div>
            <h2>Filter</h2>
          </div>
          <button class="markdown-dialog-close" id="closeTaskFilterDialogBtn" type="button" aria-label="Close filter dialog">&times;</button>
        </div>
        <div class="filter-dialog-body">
          <label class="filter-field" for="taskFilterIdInput">
            <span>Task ID</span>
            <input id="taskFilterIdInput" type="text" autocomplete="off" placeholder="IWSP-4456" value="\${escapeHtml(filterDialogState.taskId || '')}">
          </label>
          <fieldset class="filter-section">
            <legend>Status</legend>
            <label class="filter-option" for="taskFilterPendingInput">
              <input id="taskFilterPendingInput" type="checkbox" \${filterDialogState.pending ? 'checked' : ''}>
              <span>Pending</span>
            </label>
            <label class="filter-option" for="taskFilterDoingInput">
              <input id="taskFilterDoingInput" type="checkbox" \${filterDialogState.doing ? 'checked' : ''}>
              <span>On-job doing</span>
            </label>
            <label class="filter-option" for="taskFilterSuccessInput">
              <input id="taskFilterSuccessInput" type="checkbox" \${filterDialogState.success ? 'checked' : ''}>
              <span>Success</span>
            </label>
          </fieldset>
          <fieldset class="filter-section">
            <legend>Categories</legend>
            <label class="filter-option" for="taskFilterTaskInput">
              <input id="taskFilterTaskInput" type="checkbox" \${filterDialogState.task ? 'checked' : ''}>
              <span>Task</span>
            </label>
            <label class="filter-option" for="taskFilterBugInput">
              <input id="taskFilterBugInput" type="checkbox" \${filterDialogState.bug ? 'checked' : ''}>
              <span>Bug</span>
            </label>
            <label class="filter-option" for="taskFilterAnalysisInput">
              <input id="taskFilterAnalysisInput" type="checkbox" \${filterDialogState.analysis ? 'checked' : ''}>
              <span>Analysis</span>
            </label>
          </fieldset>
          <p class="filter-dialog-status\${filterDialogState.isError ? ' error' : ''}">\${escapeHtml(filterDialogState.message || '')}</p>
        </div>
        <div class="filter-dialog-actions">
          <button class="secondary" id="cancelTaskFilterDialogBtn" type="button">Cancel</button>
          <button id="applyTaskFilterDialogBtn" type="button">Apply</button>
        </div>
      </div>
    </div>
  \`;

  if (existingDialog) {
    existingDialog.outerHTML = dialogHtml;
  } else {
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
  }

  bindTaskFilterDialog();
}

function bindTaskFilterDialog() {
  const closeButton = document.getElementById('closeTaskFilterDialogBtn');
  const cancelButton = document.getElementById('cancelTaskFilterDialogBtn');
  const applyButton = document.getElementById('applyTaskFilterDialogBtn');
  const taskIdInput = document.getElementById('taskFilterIdInput');
  const pendingInput = document.getElementById('taskFilterPendingInput');
  const doingInput = document.getElementById('taskFilterDoingInput');
  const successInput = document.getElementById('taskFilterSuccessInput');
  const taskInput = document.getElementById('taskFilterTaskInput');
  const bugInput = document.getElementById('taskFilterBugInput');
  const analysisInput = document.getElementById('taskFilterAnalysisInput');

  if (closeButton) {
    closeButton.onclick = closeTaskFilterDialog;
  }

  if (cancelButton) {
    cancelButton.onclick = closeTaskFilterDialog;
  }

  if (applyButton) {
    applyButton.onclick = applyTaskFilterDialog;
  }

  if (taskIdInput) {
    taskIdInput.oninput = () => {
      filterDialogState.taskId = taskIdInput.value;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
    taskIdInput.onkeydown = event => {
      if (event.key === 'Enter') {
        applyTaskFilterDialog();
      }
    };
  }

  if (pendingInput) {
    pendingInput.onchange = () => {
      filterDialogState.pending = pendingInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }

  if (doingInput) {
    doingInput.onchange = () => {
      filterDialogState.doing = doingInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }

  if (successInput) {
    successInput.onchange = () => {
      filterDialogState.success = successInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }

  if (taskInput) {
    taskInput.onchange = () => {
      filterDialogState.task = taskInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }

  if (bugInput) {
    bugInput.onchange = () => {
      filterDialogState.bug = bugInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }

  if (analysisInput) {
    analysisInput.onchange = () => {
      filterDialogState.analysis = analysisInput.checked;
      filterDialogState.message = '';
      filterDialogState.isError = false;
    };
  }
}

function selectTaskItem(id, type) {
  if (!id || !type) {
    return;
  }

  listMessage = 'Opening ' + itemTypeText(type) + ' ' + id + '...';
  renderListView();
  vscode.postMessage({
    command: 'selectTaskItem',
    data: { id, type }
  });
}

function deleteTaskItem(id, type) {
  if (!id || !type) {
    return;
  }

  const confirmed = confirm('Delete ' + itemTypeText(type) + ' ' + id + ' and its cached data?');
  if (!confirmed) {
    return;
  }

  listMessage = 'Deleting ' + itemTypeText(type) + ' ' + id + '...';
  renderListView();
  vscode.postMessage({
    command: 'deleteTaskItem',
    data: { id, type }
  });
}

function showListView() {
  currentItem = null;
  if (taskState) {
    taskState.currentItem = undefined;
  }
  currentMode = 'task';
  createFormState.type = modeToItemType(currentMode);
  selectedNodeId = 'document';
  listMessage = '';
  showView('list');
  vscode.postMessage({
    command: 'getTaskManagerState',
    data: { mode: currentMode }
  });
}
  `;
}
