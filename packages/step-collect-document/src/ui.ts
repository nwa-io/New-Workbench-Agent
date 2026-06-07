/**
 * Client-side detail UI for the Collect Document step, concatenated into the Task
 * Manager webview's single global scope by core's webview assembly. It reads the
 * shell-owned globals `taskState`, `escapeHtml`, `getActiveModeCopy`,
 * `getTaskRequestContext`, and `vscode`, and defines `renderDocumentDetail` which
 * the shell's detail view invokes by name. Upload/open messages
 * (`uploadTaskDocument`, `openTaskDocument`) are still handled by core.
 */
export const documentDetailScript = `
function renderDocumentDetail(detail) {
  const copy = getActiveModeCopy();
  const sourceDocuments = taskState.sourceDocuments || [];
  const documents = taskState.documents || [];
  const sourceDocumentItems = sourceDocuments.length > 0
    ? sourceDocuments.map((document, index) => \`
      <div class="document-item">
        <div>
          <div class="document-name">\${escapeHtml(document.name)}</div>
          <div class="document-path">\${escapeHtml(document.workspacePath)}</div>
        </div>
        <button class="secondary link-button" type="button" data-source-doc-index="\${index}">Open</button>
      </div>
    \`).join('')
    : '<p class="empty-state">No source documents selected yet.</p>';
  const documentItems = documents.length > 0
    ? documents.map((document, index) => \`
      <div class="document-item">
        <div>
          <div class="document-name">\${escapeHtml(document.name)}</div>
          <div class="document-path">\${escapeHtml(document.workspacePath)}</div>
        </div>
        <button class="secondary link-button" type="button" data-doc-index="\${index}">Open</button>
      </div>
    \`).join('')
    : '<p class="empty-state">No markdown generated yet. Click RUN to convert selected files.</p>';

  detail.innerHTML = \`
    <div class="detail-header">
      <h2>\${escapeHtml(copy.documentTitle)}</h2>
      <p class="detail-copy">\${escapeHtml(copy.documentCopy)}</p>
    </div>

    <div class="drop-zone" id="documentDropZone">
      <div>
        <div class="drop-title">Drop documents here</div>
        <div class="drop-copy">Files are saved to .project/docs. RUN converts them to markdown with markitdown.</div>
        <button type="button" id="chooseDocumentBtn">Choose files</button>
        <input type="file" id="documentFileInput" multiple hidden
          accept=".md,.markdown,.txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.htm,.csv,.json,.xml">
        <div class="upload-status" id="uploadStatus"></div>
      </div>
    </div>

    <div class="document-list">
      <h3>Selected source files</h3>
      \${sourceDocumentItems}
    </div>

    <div class="document-list">
      <h3>Generated markdown</h3>
      \${documentItems}
    </div>
  \`;

  bindDocumentDropzone();
  bindDocumentOpenButtons();
}

function bindDocumentDropzone() {
  const dropZone = document.getElementById('documentDropZone');
  const fileInput = document.getElementById('documentFileInput');
  const chooseButton = document.getElementById('chooseDocumentBtn');

  chooseButton.onclick = () => fileInput.click();
  fileInput.onchange = () => uploadFiles(Array.from(fileInput.files || []));

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    });
  });

  dropZone.addEventListener('drop', event => {
    uploadFiles(Array.from(event.dataTransfer?.files || []));
  });
}

function bindDocumentOpenButtons() {
  document.querySelectorAll('[data-source-doc-index]').forEach(button => {
    button.onclick = () => {
      const documentItem = (taskState.sourceDocuments || [])[Number(button.dataset.sourceDocIndex)];
      if (!documentItem) {
        return;
      }

      vscode.postMessage({
        command: 'openTaskDocument',
        data: { workspacePath: documentItem.workspacePath }
      });
    };
  });

  document.querySelectorAll('[data-doc-index]').forEach(button => {
    button.onclick = () => {
      const documentItem = (taskState.documents || [])[Number(button.dataset.docIndex)];
      if (!documentItem) {
        return;
      }

      vscode.postMessage({
        command: 'openTaskDocument',
        data: { workspacePath: documentItem.workspacePath }
      });
    };
  });
}

async function uploadFiles(files) {
  if (files.length === 0) {
    return;
  }

  setUploadStatus(\`Selecting \${files.length} file\${files.length === 1 ? '' : 's'}...\`);

  for (const file of files) {
    try {
      const contentBase64 = await readFileAsBase64(file);
      vscode.postMessage({
        command: 'uploadTaskDocument',
        data: getTaskRequestContext({
          fileName: file.name,
          contentBase64
        })
      });
    } catch (error) {
      setUploadStatus(error.message || 'Unable to read file.', true);
    }
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function setUploadStatus(message, isError = false) {
  const status = document.getElementById('uploadStatus');
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle('error', isError);
}
`;
