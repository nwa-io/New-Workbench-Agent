export function getMessageHandlerScript(): string {
  return `
window.addEventListener('message', event => {
  const message = event.data;

  if (message.command === 'taskManagerState') {
    applyTaskState(message.data, currentView === 'detail');
    renderShellViews();
  } else if (message.command === 'taskIntegrationSettings') {
    integrationState = message.data || integrationState;
    if (document.getElementById('taskDetail')) {
      renderDetail();
    }
  } else if (message.command === 'taskItemCreateComplete') {
    applyTaskState(message.data.state, true);
    currentItem = message.data.item;
    selectedNodeId = 'document';
    selectedWorkflowStepKey = '';
    selectedWorkflowStep = null;
    detailModalState.isOpen = false;
    resetDetailFormState();
    createFormState.isCreating = false;
    createFormState.message = '';
    listMessage = '';
    showView('detail');
  } else if (message.command === 'taskItemCreateFailed') {
    createFormState.isCreating = false;
    createFormState.isError = true;
    createFormState.message = message.data.message || 'Create failed.';
    renderCreateView();
  } else if (message.command === 'taskItemSelectComplete') {
    applyTaskState(message.data.state, true);
    currentItem = message.data.item;
    selectedNodeId = 'document';
    selectedWorkflowStepKey = '';
    selectedWorkflowStep = null;
    detailModalState.isOpen = false;
    resetDetailFormState();
    listMessage = '';
    showView('detail');
  } else if (message.command === 'taskItemSelectFailed') {
    listMessage = message.data.message || 'Open failed.';
    renderListView();
  } else if (message.command === 'taskItemDeleteComplete') {
    currentItem = null;
    deleteConfirmState.isOpen = false;
    deleteConfirmState.id = '';
    deleteConfirmState.type = '';
    deleteConfirmState.isDeleting = false;
    renderDeleteConfirmDialog();
    applyTaskState(message.data.state);
    listMessage = 'Item deleted.';
    showView('list');
  } else if (message.command === 'taskItemDeleteFailed') {
    deleteConfirmState.isOpen = false;
    deleteConfirmState.id = '';
    deleteConfirmState.type = '';
    deleteConfirmState.isDeleting = false;
    renderDeleteConfirmDialog();
    listMessage = message.data.message || 'Delete failed.';
    renderListView();
  } else if (message.command === 'taskDocumentUploadComplete') {
    applyTaskState(message.data.state, true);
    refreshDetailView();
    setUploadStatus('Selected ' + message.data.document.name);
  } else if (message.command === 'taskDocumentUploadFailed') {
    setUploadStatus(message.data.message || 'Document selection failed.', true);
  } else if (message.command === 'taskMarkdownLoaded') {
    applyTaskState(message.data.state, true);
    markdownDialogState.content = message.data.markdown.content || '';
    markdownDialogState.isLoading = false;
    markdownDialogState.isSaving = false;
    markdownDialogState.isRunning = false;
    markdownDialogState.isError = false;
    markdownDialogState.message = markdownDialogState.isRegenerating
      ? 'Markdown brief regenerated from current sources.'
      : message.data.markdown.updatedAt
        ? 'Edited markdown brief loaded.'
        : 'Generated markdown brief loaded.';
    markdownDialogState.isRegenerating = false;
    if (workflowRunState.pendingRun) {
      runWorkflowMarkdownContent(markdownDialogState.content);
      renderMarkdownDialog();
      return;
    }
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownUpdated') {
    applyTaskState(message.data.state, true);
    markdownDialogState.content = message.data.markdown.content !== undefined
      ? message.data.markdown.content
      : markdownDialogState.content;
    markdownDialogState.isLoading = false;
    markdownDialogState.isSaving = false;
    markdownDialogState.isRunning = false;
    markdownDialogState.isRegenerating = false;
    markdownDialogState.isError = false;
    markdownDialogState.message = 'Markdown brief saved.';
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownFailed') {
    if (workflowRunState.pendingRun || workflowRunState.status === 'running') {
      failWorkflowRun(message.data.message || 'Markdown brief failed.');
      renderMarkdownDialog();
      return;
    }
    markdownDialogState.isLoading = false;
    markdownDialogState.isSaving = false;
    markdownDialogState.isRunning = false;
    markdownDialogState.isRegenerating = false;
    markdownDialogState.isError = true;
    markdownDialogState.message = message.data.message || 'Markdown brief failed.';
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownRunStarted' || message.command === 'taskMarkdownRunComplete') {
    if (message.data.state) {
      applyTaskState(message.data.state, true);
    }
    markdownDialogState.isRunning = false;
    markdownDialogState.isOpen = false;
    markdownDialogState.isError = false;
    markdownDialogState.message = '';
    workflowRunState.status = 'running';
    workflowRunState.pendingRun = false;
    workflowRunState.message = message.data.message || 'Claude Code terminal opened.';
    codeRunState.isRunning = true;
    codeRunState.isError = false;
    codeRunState.message = message.data.message || 'Claude Code terminal opened.';
    codeRunState.markdownPath = message.data.markdownPath || codeRunState.markdownPath;
    selectedNodeId = 'code';
    selectedWorkflowStepKey = '';
    selectedWorkflowStep = null;
    detailModalState.isOpen = false;
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownRunFailed') {
    workflowRunState.status = 'idle';
    workflowRunState.pendingRun = false;
    workflowRunState.message = message.data.message || 'Run failed.';
    markdownDialogState.isRunning = false;
    markdownDialogState.isError = true;
    markdownDialogState.message = message.data.message || 'Run failed.';
    codeRunState.isRunning = false;
    codeRunState.isError = true;
    codeRunState.message = message.data.message || 'Run failed.';
    selectedNodeId = 'code';
    selectedWorkflowStepKey = '';
    selectedWorkflowStep = null;
    detailModalState.isOpen = true;
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownRunStopped') {
    workflowRunState.status = 'finished';
    workflowRunState.pendingRun = false;
    workflowRunState.message = 'Workflow completed.';
    codeRunState.isRunning = false;
    codeRunState.isError = false;
    codeRunState.message = message.data.message || 'Claude Code terminal closed.';
    codeRunState.markdownPath = message.data.markdownPath || codeRunState.markdownPath;
    refreshDetailView();
  } else if (message.command === 'taskWorkflowRunPrepared') {
    if (message.data.state) {
      applyTaskState(message.data.state, true);
    }
    setWorkflowFromRunMessage(message.data.workflow);
    workflowRunState.status = 'running';
    workflowRunState.pendingRun = false;
    workflowRunState.message = 'Running workflow...';
    codeRunState.isRunning = false;
    codeRunState.isError = false;
    codeRunState.message = '';
    refreshDetailView();
  } else if (message.command === 'taskWorkflowStatusChanged') {
    updateWorkflowBlockStatus(message.data.blockId, message.data.status);
    workflowRunState.status = 'running';
    workflowRunState.pendingRun = false;
    refreshDetailView();
  } else if (message.command === 'taskWorkflowRunMessage') {
    workflowRunState.message = message.data.message || workflowRunState.message;
    renderTree();
  } else if (message.command === 'taskWorkflowRunComplete') {
    if (message.data.state) {
      applyTaskState(message.data.state, true);
    }
    setWorkflowFromRunMessage(message.data.workflow);
    workflowRunState.status = 'finished';
    workflowRunState.pendingRun = false;
    workflowRunState.message = 'Workflow completed.';
    codeRunState.isRunning = false;
    codeRunState.isError = false;
    codeRunState.message = '';
    refreshDetailView();
  } else if (message.command === 'taskWorkflowRunFailed') {
    if (message.data.state) {
      applyTaskState(message.data.state, true);
    }
    setWorkflowFromRunMessage(message.data.workflow);
    failTaskWorkflowRun(message.data.message || 'Workflow failed.', message.data.blockId);
  } else if (message.command === 'taskWorkflowStepDoneComplete') {
    applyTaskState(message.data.state, true);
    setWorkflowFromRunMessage(message.data.workflow);
    workflowRunState.message = 'Step marked completed.';
    markdownDialogState.isRunning = false;
    markdownDialogState.isError = false;
    markdownDialogState.message = workflowRunState.message;
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskWorkflowStepDoneFailed') {
    markdownDialogState.isRunning = false;
    markdownDialogState.isError = true;
    markdownDialogState.message = message.data.message || 'Unable to mark step completed.';
    showWorkflowErrorPopup(markdownDialogState.message);
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'figmaTaskLinkSyncComplete') {
    applyTaskState(message.data.state, true);
    figmaFormState.isSyncing = false;
    figmaFormState.isError = false;
    figmaFormState.highlightToken = false;
    figmaFormState.activeTab = 'task-link';
    figmaFormState.link = message.data.connection.link || figmaFormState.link;
    figmaFormState.message = 'Connected to ' + message.data.connection.fileName + '.';
    refreshDetailView();
  } else if (message.command === 'figmaTaskLinkSyncFailed') {
    figmaFormState.isSyncing = false;
    figmaFormState.isError = true;
    figmaFormState.message = message.data.message || 'Figma sync failed.';
    renderDetail();
  } else if (message.command === 'figmaNodeSelectionUpdated') {
    applyTaskState(message.data.state, true);
    renderTree();
    updateFigmaNodeSelectionUi(taskState.figma);
  } else if (message.command === 'figmaNodeSelectionFailed') {
    figmaFormState.isError = true;
    figmaFormState.message = message.data.message || 'Figma node selection failed.';
    renderDetail();
  } else if (message.command === 'figmaNodeTitleCopied') {
    figmaFormState.isError = false;
    figmaFormState.message = 'Copied title: ' + message.data.title;
    updateFigmaNodeSelectionUi(taskState.figma);
  } else if (message.command === 'figmaNodeTitleCopyFailed') {
    figmaFormState.isError = true;
    figmaFormState.message = message.data.message || 'Copy title failed.';
    updateFigmaNodeSelectionUi(taskState.figma);
  } else if (message.command === 'jiraOpenComplete') {
    applyTaskState(message.data.state, true);
    jiraFormState.isOpening = false;
    jiraFormState.isReading = false;
    jiraFormState.isError = false;
    jiraFormState.link = message.data.connection.link || jiraFormState.link;
    jiraFormState.message = 'Chrome opened. Log in to Jira there if needed, then click RUN.';
    refreshDetailView();
  } else if (message.command === 'jiraOpenFailed') {
    jiraFormState.isOpening = false;
    jiraFormState.isReading = false;
    jiraFormState.isError = true;
    jiraFormState.message = message.data.message || 'Jira open failed.';
    renderDetail();
  } else if (message.command === 'jiraReadComplete') {
    applyTaskState(message.data.state, true);
    jiraFormState.isOpening = false;
    jiraFormState.isReading = false;
    jiraFormState.isError = false;
    jiraFormState.link = message.data.connection.link || jiraFormState.link;
    jiraFormState.message = 'Read Jira ticket content and saved markdown. Playwright Chrome closed.';
    refreshDetailView();
  } else if (message.command === 'jiraReadFailed') {
    jiraFormState.isOpening = false;
    jiraFormState.isReading = false;
    jiraFormState.isError = true;
    jiraFormState.message = message.data.message || 'Jira read failed.';
    renderDetail();
  } else if (message.command === 'taskModeChanged') {
    currentMode = message.data.mode;
    currentItem = null;
    selectedNodeId = 'document';
    selectedWorkflowStepKey = '';
    selectedWorkflowStep = null;
    detailModalState.isOpen = false;
    workflowRunState.status = 'idle';
    workflowRunState.pendingRun = false;
    workflowRunState.message = '';
    createFormState.type = modeToItemType(currentMode);
    showView('list');
  }
});

document.getElementById('taskCreateHeaderBtn').onclick = openCreateView;
document.getElementById('taskFilterHeaderBtn').onclick = openTaskFilterDialog;

updateModeControls();
renderShellViews();
requestState();
  `;
}
