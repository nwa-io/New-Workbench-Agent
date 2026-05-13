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
    resetDetailFormState();
    listMessage = '';
    showView('detail');
  } else if (message.command === 'taskItemSelectFailed') {
    listMessage = message.data.message || 'Open failed.';
    renderListView();
  } else if (message.command === 'taskItemDeleteComplete') {
    currentItem = null;
    applyTaskState(message.data.state);
    listMessage = 'Item deleted.';
    showView('list');
  } else if (message.command === 'taskItemDeleteFailed') {
    listMessage = message.data.message || 'Delete failed.';
    renderListView();
  } else if (message.command === 'taskDocumentUploadComplete') {
    applyTaskState(message.data.state, true);
    refreshDetailView();
    setUploadStatus('Saved ' + message.data.document.name);
  } else if (message.command === 'taskDocumentUploadFailed') {
    setUploadStatus(message.data.message || 'Document import failed.', true);
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
    codeRunState.isRunning = true;
    codeRunState.isError = false;
    codeRunState.message = message.data.message || 'Claude Code terminal opened.';
    codeRunState.markdownPath = message.data.markdownPath || codeRunState.markdownPath;
    selectedNodeId = 'code';
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownRunFailed') {
    markdownDialogState.isRunning = false;
    markdownDialogState.isError = true;
    markdownDialogState.message = message.data.message || 'Run failed.';
    codeRunState.isRunning = false;
    codeRunState.isError = true;
    codeRunState.message = message.data.message || 'Run failed.';
    selectedNodeId = 'code';
    refreshDetailView();
    renderMarkdownDialog();
  } else if (message.command === 'taskMarkdownRunStopped') {
    codeRunState.isRunning = false;
    codeRunState.isError = false;
    codeRunState.message = message.data.message || 'Claude Code terminal closed.';
    codeRunState.markdownPath = message.data.markdownPath || codeRunState.markdownPath;
    refreshDetailView();
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
    jiraFormState.message = 'Chrome opened. Log in to Jira there if needed, then click Read ticket.';
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
