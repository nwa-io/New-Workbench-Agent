export function getMarkdownDialogScript(): string {
  return `
function openMarkdownDialog() {
  markdownDialogState.isOpen = true;
  markdownDialogState.isLoading = true;
  markdownDialogState.isRegenerating = false;
  markdownDialogState.isError = false;
  markdownDialogState.message = 'Loading markdown brief...';
  renderMarkdownDialog();

  vscode.postMessage({
    command: 'getTaskMarkdown',
    data: getTaskRequestContext()
  });
}

function closeMarkdownDialog() {
  markdownDialogState.isOpen = false;
  renderMarkdownDialog();
}

function setMarkdownDialogMode(mode) {
  markdownDialogState.mode = mode;
  captureMarkdownEditor();
  renderMarkdownDialog();
}

function captureMarkdownEditor() {
  const editor = document.getElementById('taskMarkdownEditor');
  if (editor) {
    markdownDialogState.content = editor.value;
  }
}

function saveMarkdownDialog() {
  captureMarkdownEditor();

  if (markdownDialogState.isSaving) {
    return;
  }

  markdownDialogState.isSaving = true;
  markdownDialogState.isError = false;
  markdownDialogState.message = 'Saving markdown brief...';
  renderMarkdownDialog();

  vscode.postMessage({
    command: 'updateTaskMarkdown',
    data: getTaskRequestContext({
      content: markdownDialogState.content
    })
  });
}

function regenerateMarkdownDialog() {
  if (markdownDialogState.isLoading || markdownDialogState.isSaving || markdownDialogState.isRunning || markdownDialogState.isRegenerating) {
    return;
  }

  markdownDialogState.isLoading = true;
  markdownDialogState.isRegenerating = true;
  markdownDialogState.isError = false;
  markdownDialogState.message = 'Regenerating markdown brief...';
  renderMarkdownDialog();

  vscode.postMessage({
    command: 'getTaskMarkdown',
    data: getTaskRequestContext({
      regenerate: true
    })
  });
}

function runMarkdownDialog() {
  captureMarkdownEditor();

  if (markdownDialogState.isLoading || markdownDialogState.isRunning) {
    return;
  }

  if (!markdownDialogState.content.trim()) {
    markdownDialogState.isError = true;
    markdownDialogState.message = 'No markdown brief to run.';
    renderMarkdownDialog();
    return;
  }

  markdownDialogState.isRunning = true;
  markdownDialogState.isError = false;
  markdownDialogState.message = 'Opening Claude Code terminal...';
  markdownDialogState.isOpen = false;
  codeRunState.isRunning = true;
  codeRunState.isError = false;
  codeRunState.message = 'Opening Claude Code terminal...';
  codeRunState.markdownPath = '';
  selectedNodeId = 'code';
  renderMarkdownDialog();
  refreshDetailView();

  vscode.postMessage({
    command: 'runTaskMarkdown',
    data: getTaskRequestContext({
      content: markdownDialogState.content
    })
  });
}

function renderMarkdownDialog() {
  const existingDialog = document.getElementById('taskMarkdownDialog');
  if (!markdownDialogState.isOpen) {
    if (existingDialog) {
      existingDialog.remove();
    }
    return;
  }

  const bodyHtml = markdownDialogState.isLoading
    ? '<p class="empty-state">Loading markdown brief...</p>'
    : markdownDialogState.mode === 'edit'
      ? \`<textarea id="taskMarkdownEditor" class="markdown-editor" spellcheck="false">\${escapeHtml(markdownDialogState.content)}</textarea>\`
      : \`<pre class="markdown-review">\${escapeHtml(markdownDialogState.content || 'No markdown brief generated yet.')}</pre>\`;
  const saveButtonHtml = markdownDialogState.mode === 'edit'
    ? \`<button id="saveMarkdownDialogBtn" type="button" \${markdownDialogState.isSaving ? 'disabled' : ''}>Save</button>\`
    : '';
  const dialogHtml = \`
    <div class="markdown-dialog-backdrop" id="taskMarkdownDialog">
      <div class="markdown-dialog" role="dialog" aria-modal="true" aria-label="Markdown brief">
        <div class="markdown-dialog-header">
          <div>
            <h2>Markdown</h2>
            <p class="detail-copy">Review or edit the brief before using it for code work.</p>
          </div>
          <button class="markdown-dialog-close" id="closeMarkdownDialogBtn" type="button" aria-label="Close markdown dialog">&times;</button>
        </div>
        <div class="markdown-dialog-toolbar">
          <div class="markdown-mode-switch" role="tablist" aria-label="Markdown mode">
            <button class="markdown-mode-button\${markdownDialogState.mode === 'review' ? ' active' : ''}" type="button" data-markdown-mode="review">Review</button>
            <button class="markdown-mode-button\${markdownDialogState.mode === 'edit' ? ' active' : ''}" type="button" data-markdown-mode="edit">Edit</button>
          </div>
          <button class="secondary markdown-regenerate-button" id="regenerateMarkdownDialogBtn" type="button" \${markdownDialogState.isLoading || markdownDialogState.isSaving || markdownDialogState.isRunning || markdownDialogState.isRegenerating ? 'disabled' : ''}>Regenerate</button>
        </div>
        <p class="markdown-dialog-status\${markdownDialogState.isError ? ' error' : ''}">\${escapeHtml(markdownDialogState.message || '')}</p>
        <div class="markdown-dialog-body">
          \${bodyHtml}
        </div>
        <div class="markdown-dialog-actions">
          <button class="secondary" id="cancelMarkdownDialogBtn" type="button">Close</button>
          \${saveButtonHtml}
          <button id="runMarkdownDialogBtn" type="button" \${markdownDialogState.isLoading || markdownDialogState.isRunning ? 'disabled' : ''}>Run</button>
        </div>
      </div>
    </div>
  \`;

  if (existingDialog) {
    existingDialog.outerHTML = dialogHtml;
  } else {
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
  }

  bindMarkdownDialog();
}

function bindMarkdownDialog() {
  const closeButton = document.getElementById('closeMarkdownDialogBtn');
  const cancelButton = document.getElementById('cancelMarkdownDialogBtn');
  const saveButton = document.getElementById('saveMarkdownDialogBtn');
  const runButton = document.getElementById('runMarkdownDialogBtn');
  const regenerateButton = document.getElementById('regenerateMarkdownDialogBtn');
  const editor = document.getElementById('taskMarkdownEditor');

  if (closeButton) {
    closeButton.onclick = closeMarkdownDialog;
  }

  if (cancelButton) {
    cancelButton.onclick = closeMarkdownDialog;
  }

  if (saveButton) {
    saveButton.onclick = saveMarkdownDialog;
  }

  if (runButton) {
    runButton.onclick = runMarkdownDialog;
  }

  if (regenerateButton) {
    regenerateButton.onclick = regenerateMarkdownDialog;
  }

  if (editor) {
    editor.oninput = () => {
      markdownDialogState.content = editor.value;
    };
    editor.focus();
  }

  document.querySelectorAll('[data-markdown-mode]').forEach(button => {
    button.onclick = () => {
      setMarkdownDialogMode(button.dataset.markdownMode);
    };
  });
}
  `;
}
