import { TaskManagerMode } from '../../models/TaskManager';

export function getTaskScriptContent(initialMode: TaskManagerMode): string {
  return `
    <script>
      const vscode = acquireVsCodeApi();
      const initialMode = ${JSON.stringify(initialMode)};

      let currentView = 'list';
      let currentMode = initialMode;
      let currentItem = null;
      let taskItems = [];
      let listMessage = '';
      let selectedNodeId = 'document';
      let taskState = {
        mode: currentMode,
        items: [],
        projectFolder: '.project',
        documentsFolder: '',
        documents: [],
        nodes: []
      };
      let createFormState = {
        type: modeToItemType(initialMode),
        id: '',
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
          summary: 'Prepare context for a new task.',
          documentTitle: 'Document',
          documentCopy: 'Import SRS, PDF, Office, text, or markdown files for the new task.'
        },
        'fix-bug': {
          summary: 'Prepare context for a bug fix in existing code.',
          documentTitle: 'Bug document',
          documentCopy: 'Import bug reports, reproduction notes, logs, screenshots converted by markitdown, or related markdown files.'
        }
      };

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
        const backButton = document.getElementById('taskBackBtn');
        const summary = document.getElementById('taskModeSummary');

        createButton.hidden = currentView !== 'list';
        backButton.hidden = currentView === 'list';

        if (currentView === 'detail' && currentItem) {
          summary.textContent = itemTypeLabel(currentItem.type) + ' ' + currentItem.id + ' - ' + currentItem.folderPath;
        } else if (currentView === 'create') {
          summary.textContent = 'Create a task or bug item under ' + (taskState.projectFolder || '.project') + '.';
        } else {
          summary.textContent = modeCopy[currentMode].summary;
        }
      }

      function modeToItemType(mode) {
        return mode === 'fix-bug' ? 'bug' : 'task';
      }

      function itemTypeToMode(type) {
        return type === 'bug' ? 'fix-bug' : 'task';
      }

      function itemTypeLabel(type) {
        return type === 'bug' ? 'Bug' : 'Task';
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

      function renderListView() {
        const list = document.getElementById('taskItemList');
        const title = document.getElementById('taskListTitle');
        const meta = document.getElementById('taskListMeta');
        const activeType = modeToItemType(currentMode);
        const visibleItems = (taskItems || []).filter(item => item.type === activeType);

        title.textContent = activeType === 'bug' ? 'Bugs' : 'Tasks';
        meta.textContent = visibleItems.length + ' ' + itemTypeLabel(activeType).toLowerCase() + (visibleItems.length === 1 ? '' : 's') + ' in ' + (taskState.projectFolder || '.project') + '/' + activeType;

        if (listMessage) {
          meta.textContent = listMessage;
        }

        list.innerHTML = visibleItems.length > 0
          ? visibleItems.map(item => getTaskItemCardHtml(item)).join('')
          : '<p class="empty-state">No ' + (activeType === 'bug' ? 'bugs' : 'tasks') + ' created yet.</p>';

        bindTaskItemList();
      }

      function getTaskItemCardHtml(item) {
        const updatedAt = item.updatedAt ? formatDateTime(item.updatedAt) : '-';
        const statusParts = [
          item.hasJira ? 'Jira' : null,
          item.hasFigmaCache ? 'Figma' : null,
          item.hasMarkdown ? 'Markdown' : null
        ].filter(Boolean);
        const statusText = statusParts.length > 0 ? statusParts.join(', ') : 'No synced data';

        return '<div class="task-item-card">' +
          '<div class="task-item-main">' +
            '<div class="task-item-title">' +
              '<span class="status-badge status-ready">' + escapeHtml(itemTypeLabel(item.type)) + '</span>' +
              '<span>' + escapeHtml(item.id) + '</span>' +
            '</div>' +
            '<div class="task-item-meta">Updated: ' + escapeHtml(updatedAt) + ' - ' + escapeHtml(statusText) + '</div>' +
            '<div class="task-item-paths">' + escapeHtml(item.folderPath) + '</div>' +
          '</div>' +
          '<div class="task-item-actions">' +
            '<button class="secondary" type="button" data-delete-task-item data-item-id="' + escapeHtml(item.id) + '" data-item-type="' + escapeHtml(item.type) + '">Delete</button>' +
            '<button type="button" data-open-task-item data-item-id="' + escapeHtml(item.id) + '" data-item-type="' + escapeHtml(item.type) + '">Open</button>' +
          '</div>' +
        '</div>';
      }

      function bindTaskItemList() {
        document.querySelectorAll('[data-open-task-item]').forEach(button => {
          button.onclick = () => {
            selectTaskItem(button.dataset.itemId, button.dataset.itemType);
          };
        });

        document.querySelectorAll('[data-delete-task-item]').forEach(button => {
          button.onclick = () => {
            deleteTaskItem(button.dataset.itemId, button.dataset.itemType);
          };
        });
      }

      function openCreateView() {
        createFormState.type = modeToItemType(currentMode);
        createFormState.id = '';
        createFormState.message = '';
        createFormState.isError = false;
        createFormState.isCreating = false;
        showView('create');
      }

      function renderCreateView() {
        document.getElementById('createTypeTask').classList.toggle('active', createFormState.type === 'task');
        document.getElementById('createTypeBug').classList.toggle('active', createFormState.type === 'bug');

        const idInput = document.getElementById('taskItemIdInput');
        if (idInput && idInput.value !== createFormState.id) {
          idInput.value = createFormState.id;
        }

        const status = document.getElementById('taskCreateStatus');
        status.textContent = createFormState.message || '';
        status.classList.toggle('error', createFormState.isError);
        document.getElementById('taskCreateSubmitBtn').disabled = createFormState.isCreating;

        bindCreateView();
      }

      function bindCreateView() {
        document.querySelectorAll('[data-create-type]').forEach(button => {
          button.onclick = () => {
            createFormState.type = button.dataset.createType;
            currentMode = itemTypeToMode(createFormState.type);
            renderCreateView();
            updateModeControls();
          };
        });

        const idInput = document.getElementById('taskItemIdInput');
        if (idInput) {
          idInput.oninput = () => {
            createFormState.id = idInput.value;
          };
          idInput.onkeydown = event => {
            if (event.key === 'Enter') {
              submitCreateItem();
            }
          };
        }

        document.getElementById('taskCreateCancelBtn').onclick = () => showView('list');
        document.getElementById('taskCreateSubmitBtn').onclick = submitCreateItem;
      }

      function submitCreateItem() {
        const idInput = document.getElementById('taskItemIdInput');
        createFormState.id = idInput ? idInput.value.trim() : createFormState.id.trim();

        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(createFormState.id)) {
          createFormState.message = 'Use letters, numbers, dots, underscores, or dashes only.';
          createFormState.isError = true;
          renderCreateView();
          return;
        }

        createFormState.isCreating = true;
        createFormState.isError = false;
        createFormState.message = 'Creating ' + itemTypeLabel(createFormState.type).toLowerCase() + '...';
        renderCreateView();

        vscode.postMessage({
          command: 'createTaskItem',
          data: {
            id: createFormState.id,
            type: createFormState.type
          }
        });
      }

      function selectTaskItem(id, type) {
        if (!id || !type) {
          return;
        }

        listMessage = 'Opening ' + itemTypeLabel(type).toLowerCase() + ' ' + id + '...';
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

        const confirmed = confirm('Delete ' + itemTypeLabel(type).toLowerCase() + ' ' + id + ' and its cached task data?');
        if (!confirmed) {
          return;
        }

        listMessage = 'Deleting ' + itemTypeLabel(type).toLowerCase() + ' ' + id + '...';
        renderListView();
        vscode.postMessage({
          command: 'deleteTaskItem',
          data: { id, type }
        });
      }

      function showListView() {
        currentItem = null;
        selectedNodeId = 'document';
        listMessage = '';
        showView('list');
        requestState();
      }

      function resetDetailFormState() {
        figmaFormState.link = '';
        figmaFormState.message = '';
        figmaFormState.isError = false;
        figmaFormState.isSyncing = false;
        figmaFormState.highlightToken = false;
        jiraFormState.link = '';
        jiraFormState.message = '';
        jiraFormState.isError = false;
        jiraFormState.isOpening = false;
        jiraFormState.isReading = false;
        markdownDialogState.content = '';
        markdownDialogState.message = '';
        markdownDialogState.isError = false;
        markdownDialogState.isLoading = false;
        markdownDialogState.isSaving = false;
        markdownDialogState.isRunning = false;
        markdownDialogState.isRegenerating = false;
        codeRunState.isRunning = false;
        codeRunState.isError = false;
        codeRunState.message = '';
        codeRunState.markdownPath = '';
      }

      function renderTree() {
        const tree = document.getElementById('taskTree');
        tree.innerHTML = '';

        const nodes = taskState.nodes.length > 0 ? taskState.nodes : [
          { id: 'document', label: 'Document', status: 'Unknown' },
          { id: 'figma', label: 'Figma', status: 'Un-sync' },
          { id: 'jira', label: 'Jira', status: 'Un-sync' },
          { id: 'markdown', label: 'Markdown', status: 'Missing' },
          { id: 'code', label: 'Code', status: 'Unknown' },
          { id: 'testcase', label: 'Testcase', status: 'Unknown' }
        ];

        const nodeLookup = nodes.reduce((lookup, node) => {
          lookup[node.id] = node;
          return lookup;
        }, {});
        const documentCount = (taskState.documents || []).length;
        const figmaSelectedCount = taskState.figma && Array.isArray(taskState.figma.selectedNodeIds)
          ? taskState.figma.selectedNodeIds.length
          : 0;
        const markdownMetaParts = [];
        if (documentCount > 0) {
          markdownMetaParts.push(documentCount + ' doc' + (documentCount === 1 ? '' : 's'));
        }
        if (figmaSelectedCount > 0) {
          markdownMetaParts.push(figmaSelectedCount + ' screen' + (figmaSelectedCount === 1 ? '' : 's'));
        }
        if (taskState.jira && taskState.jira.ticket) {
          markdownMetaParts.push('Jira');
        }
        const flowNodes = [
          createFlowNode('document', 44, 72, 238, 96, 'wide', currentMode === 'fix-bug' ? 'Bug Document' : 'Document', documentCount > 0 ? documentCount + ' markdown file' + (documentCount === 1 ? '' : 's') : 'Drop SRS, PDF, notes'),
          createFlowNode('figma', 342, 72, 112, 96, 'square', 'Figma', 'Design sync'),
          createFlowNode('jira', 532, 72, 112, 96, 'square', 'Jira', 'Issue sync'),
          createFlowNode('markdown', 278, 224, 144, 96, 'square', 'Markdown', markdownMetaParts.length > 0 ? markdownMetaParts.join(', ') : 'Brief'),
          createFlowNode('code', 154, 352, 112, 112, 'circle', 'Code', codeRunState.isRunning ? 'Claude Code' : 'Later'),
          createFlowNode('testcase', 474, 352, 112, 112, 'circle', 'Testcase', 'Later')
        ];
        const sourceReady = {
          document: isProcessNodeReady(nodeLookup.document),
          figma: isProcessNodeReady(nodeLookup.figma),
          jira: isProcessNodeReady(nodeLookup.jira)
        };

        tree.innerHTML = getFlowCanvasShell(sourceReady, codeRunState.isRunning);
        const canvas = tree.querySelector('.flow-canvas');

        flowNodes.forEach(node => {
          const sourceNode = nodeLookup[node.id] || { id: node.id, label: node.title, status: 'Unknown' };
          const displayStatus = getDisplayNodeStatus(node, sourceNode);
          if (node.type !== 'wide') {
            const label = document.createElement('span');
            label.className = 'flow-label' + (node.type === 'circle' ? ' label-above' : '');
            label.style.setProperty('--x', node.x + 'px');
            label.style.setProperty('--y', (node.type === 'circle' ? node.y : node.y + node.height + 8) + 'px');
            label.style.setProperty('--w', node.width + 'px');
            label.textContent = node.title;
            canvas.appendChild(label);
          }

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'flow-node ' + node.type +
            (node.id === selectedNodeId ? ' selected' : '') +
            (node.id === 'code' && codeRunState.isRunning ? ' running' : '');
          button.dataset.nodeId = node.id;
          button.style.setProperty('--x', node.x + 'px');
          button.style.setProperty('--y', node.y + 'px');
          button.style.setProperty('--w', node.width + 'px');
          button.style.setProperty('--h', node.height + 'px');
          button.setAttribute('aria-label', sourceNode.label + ', status ' + displayStatus);
          button.innerHTML = getFlowNodeHtml(node, displayStatus);
          button.onclick = () => {
            selectedNodeId = node.id;
            renderTree();
            renderDetail();
            if (node.id === 'markdown') {
              openMarkdownDialog();
            }
          };
          canvas.appendChild(button);
        });
      }

      function createFlowNode(id, x, y, width, height, type, title, meta) {
        return { id, x, y, width, height, type, title, meta };
      }

      function isProcessNodeReady(node) {
        return node && ['Ready', 'Sync'].includes(node.status);
      }

      function getDisplayNodeStatus(flowNode, sourceNode) {
        if (flowNode.id === 'code' && codeRunState.isRunning) {
          return 'Running';
        }

        return sourceNode?.status || 'Unknown';
      }

      function getFlowCanvasShell(sourceReady, isCodeRunning) {
        const documentLineClass = sourceReady.document ? ' ready' : '';
        const figmaLineClass = sourceReady.figma ? ' ready' : '';
        const jiraLineClass = sourceReady.jira ? ' ready' : '';
        const codeLineClass = isCodeRunning ? ' running' : '';
        const codeArrowMarker = isCodeRunning ? 'flowArrowRunning' : 'flowArrow';

        return \`
          <div class="flow-canvas">
            <svg class="flow-connectors" viewBox="0 0 700 500" aria-hidden="true">
              <defs>
                <marker id="flowArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path class="flow-arrow" d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
                <marker id="flowArrowRunning" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path class="flow-arrow running" d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              </defs>
              <path class="flow-line" d="M 282 120 L 342 120" marker-end="url(#flowArrow)"></path>
              <path class="flow-line" d="M 454 120 L 532 120" marker-end="url(#flowArrow)"></path>
              <path class="flow-line dashed source-line\${documentLineClass}" d="M 164 168 C 164 210 314 205 314 224"></path>
              <path class="flow-line dashed source-line\${figmaLineClass}" d="M 398 168 C 398 190 350 198 350 224"></path>
              <path class="flow-line dashed source-line\${jiraLineClass}" d="M 588 168 C 588 214 386 200 386 224"></path>
              <path class="flow-line dashed code-line\${codeLineClass}" d="M 278 272 C 220 310 210 328 210 352" marker-end="url(#\${codeArrowMarker})"></path>
              <path class="flow-line" d="M 422 272 C 512 302 530 326 530 352" marker-end="url(#flowArrow)"></path>
            </svg>
          </div>
        \`;
      }

      function getFlowNodeHtml(node, status) {
        const ports = node.type === 'wide'
          ? '<span class="flow-port left"></span><span class="flow-port round right"></span><span class="flow-port bottom-a"></span><span class="flow-port bottom-b"></span><span class="flow-port bottom-c"></span>'
          : '<span class="flow-port left"></span><span class="flow-port round right"></span>';

        return \`
          <span class="flow-icon">\${getNodeIcon(node.id)}</span>
          <span>
            <span class="flow-title">\${escapeHtml(node.title)}</span>
            <span class="flow-meta">\${escapeHtml(node.meta)}</span>
          </span>
          <span class="flow-status status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
          \${ports}
        \`;
      }

      function getNodeIcon(nodeId) {
        const icons = {
          document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="M9 13h6"></path><path d="M9 17h6"></path></svg>',
          figma: '<svg viewBox="0 0 24 24" fill="none"><path fill="#a78bfa" d="M13 2h4.2a3.3 3.3 0 0 1 0 6.6H13z"></path><path fill="#60a5fa" d="M13 8.6h4.2a3.3 3.3 0 0 1 0 6.6H13z"></path><path fill="#34d399" d="M13 15.2h4.2a3.3 3.3 0 1 1-4.2 3.3z"></path><path fill="#f97316" d="M6.8 8.6H13v6.6H6.8a3.3 3.3 0 0 1 0-6.6z"></path><path fill="#ef4444" d="M6.8 2H13v6.6H6.8a3.3 3.3 0 0 1 0-6.6z"></path></svg>',
          jira: '<svg viewBox="0 0 24 24" fill="none"><path fill="#2684ff" d="M12 3 4 11l8 8 8-8z"></path><path fill="#79b8ff" d="m12 3 4 4-8 8-4-4z"></path><path fill="#0052cc" d="m16 7 4 4-8 8-4-4z"></path></svg>',
          markdown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path><path d="M7 16V8l3 4 3-4v8"></path><path d="M16 8v8"></path><path d="m16 16 2-2"></path><path d="m16 16-2-2"></path></svg>',
          code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4"></path><path d="m16 8 4 4-4 4"></path><path d="m14 5-4 14"></path></svg>',
          testcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5 11.3 14 16 8.8"></path><path d="M5 4h14v16H5z"></path><path d="M8 4V2"></path><path d="M16 4V2"></path></svg>'
        };

        return icons[nodeId] || icons.document;
      }

      function renderDetail() {
        const detail = document.getElementById('taskDetail');
        const activeNode = (taskState.nodes || []).find(node => node.id === selectedNodeId);

        if (selectedNodeId === 'document') {
          renderDocumentDetail(detail);
          return;
        }

        if (selectedNodeId === 'figma') {
          renderFigmaDetail(detail, activeNode);
          return;
        }

        if (selectedNodeId === 'jira') {
          renderJiraDetail(detail, activeNode);
          return;
        }

        if (selectedNodeId === 'markdown') {
          renderMarkdownDetail(detail, activeNode);
          return;
        }

        if (selectedNodeId === 'code') {
          renderCodeDetail(detail, activeNode);
          return;
        }

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(activeNode?.label || selectedNodeId)}</h2>
            <p class="detail-copy">This source will be connected in a later step.</p>
          </div>
          <p class="empty-state">Current status: \${escapeHtml(activeNode?.status || 'Unknown')}</p>
        \`;
      }

      function renderMarkdownDetail(detail, activeNode) {
        const status = activeNode?.status || 'Missing';
        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(activeNode?.label || 'Markdown')}</h2>
            <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
            <p class="detail-copy">Condensed implementation brief from imported documents, selected Figma nodes, and Jira content.</p>
          </div>
          <button id="openMarkdownDialogBtn" type="button">Open markdown</button>
        \`;

        const openButton = document.getElementById('openMarkdownDialogBtn');
        if (openButton) {
          openButton.onclick = openMarkdownDialog;
        }
      }

      function renderCodeDetail(detail, activeNode) {
        const status = codeRunState.isRunning ? 'Running' : activeNode?.status || 'Unknown';
        const message = codeRunState.message || (codeRunState.isRunning
          ? 'Claude Code terminal is running against the saved markdown brief.'
          : 'Run Markdown to start Claude Code against the saved brief.');
        const briefPathHtml = codeRunState.markdownPath
          ? \`<code>\${escapeHtml(codeRunState.markdownPath)}</code>\`
          : '<span>-</span>';

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>Code</h2>
            <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
            <p class="detail-copy">Claude Code execution for this task item.</p>
          </div>
          <div class="code-run-panel\${codeRunState.isRunning ? ' running' : ''}\${codeRunState.isError ? ' error' : ''}">
            <div>
              <span class="code-run-label">Markdown brief</span>
              <p>\${briefPathHtml}</p>
            </div>
            <p class="code-run-status">\${escapeHtml(message)}</p>
          </div>
        \`;
      }

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

      function renderJiraDetail(detail, activeNode) {
        const connection = taskState.jira;
        if (!jiraFormState.link && connection && connection.link) {
          jiraFormState.link = connection.link;
        }

        const status = activeNode?.status || 'Un-sync';
        const isBusy = jiraFormState.isOpening || jiraFormState.isReading;
        const syncStatus = jiraFormState.message
          ? \`<p class="jira-sync-status\${jiraFormState.isError ? ' error' : ''}">\${escapeHtml(jiraFormState.message)}</p>\`
          : '';
        const ticketPanel = getJiraTicketPanelHtml(connection);

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(activeNode?.label || 'Jira')}</h2>
            <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
            <p class="detail-copy">Open Jira with Playwright Chrome, keep the login in the extension profile, then read the ticket page content.</p>
          </div>

          <label class="form-field" for="jiraTaskLinkInput">
            <span>Jira ticket URL</span>
            <input id="jiraTaskLinkInput" type="url" inputmode="url" autocomplete="off" placeholder="https://your-domain.atlassian.net/browse/KEY-123" value="\${escapeHtml(jiraFormState.link)}">
          </label>

          <div class="jira-actions">
            <button id="jiraOpenBtn" type="button" \${isBusy ? 'disabled' : ''}>Open Chrome</button>
            <button id="jiraReadBtn" type="button" \${isBusy ? 'disabled' : ''}>Read ticket</button>
          </div>
          \${syncStatus}

          \${ticketPanel}
        \`;

        bindJiraDetail();
      }

      function bindJiraDetail() {
        const linkInput = document.getElementById('jiraTaskLinkInput');
        if (linkInput) {
          linkInput.oninput = () => {
            jiraFormState.link = linkInput.value;
          };
          linkInput.onkeydown = event => {
            if (event.key === 'Enter') {
              handleOpenJira();
            }
          };
        }

        const openButton = document.getElementById('jiraOpenBtn');
        if (openButton) {
          openButton.onclick = handleOpenJira;
        }

        const readButton = document.getElementById('jiraReadBtn');
        if (readButton) {
          readButton.onclick = handleReadJiraTicket;
        }
      }

      function captureJiraFields() {
        const linkInput = document.getElementById('jiraTaskLinkInput');
        if (linkInput) {
          jiraFormState.link = linkInput.value;
        }
      }

      function handleOpenJira() {
        captureJiraFields();

        if (jiraFormState.isOpening || jiraFormState.isReading) {
          return;
        }

        if (!jiraFormState.link.trim()) {
          jiraFormState.message = 'Paste a Jira ticket URL before opening Chrome.';
          jiraFormState.isError = true;
          renderDetail();
          setTimeout(focusJiraLinkInput, 0);
          return;
        }

        jiraFormState.isOpening = true;
        jiraFormState.message = 'Opening Playwright Chrome...';
        jiraFormState.isError = false;
        renderDetail();

        vscode.postMessage({
          command: 'openJiraInChrome',
          data: getTaskRequestContext({
            link: jiraFormState.link.trim()
          })
        });
      }

      function handleReadJiraTicket() {
        captureJiraFields();

        if (jiraFormState.isOpening || jiraFormState.isReading) {
          return;
        }

        if (!jiraFormState.link.trim()) {
          jiraFormState.message = 'Paste a Jira ticket URL before reading the page.';
          jiraFormState.isError = true;
          renderDetail();
          setTimeout(focusJiraLinkInput, 0);
          return;
        }

        jiraFormState.isReading = true;
        jiraFormState.message = 'Reading Jira ticket content...';
        jiraFormState.isError = false;
        renderDetail();

        vscode.postMessage({
          command: 'readJiraTicket',
          data: getTaskRequestContext({
            link: jiraFormState.link.trim()
          })
        });
      }

      function focusJiraLinkInput() {
        const linkInput = document.getElementById('jiraTaskLinkInput');
        if (!linkInput) {
          return;
        }

        linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        linkInput.focus();
      }

      function getJiraTicketPanelHtml(connection) {
        if (!connection || !connection.ticket) {
          return \`
            <div class="jira-ticket-section">
              <div class="jira-ticket-heading">
                <h3>Ticket content</h3>
                <span>Not read</span>
              </div>
              <p class="empty-state">Open Chrome, log in to Jira if needed, then read the ticket.</p>
            </div>
          \`;
        }

        const ticket = connection.ticket;
        const comments = Array.isArray(ticket.comments) ? ticket.comments : [];
        const metaParts = [];
        if (ticket.key) {
          metaParts.push(ticket.key);
        }
        metaParts.push('Read: ' + formatDateTime(ticket.lastReadAt));
        const descriptionHtml = ticket.description
          ? \`<pre class="jira-ticket-content">\${escapeHtml(ticket.description)}</pre>\`
          : '<p class="empty-state">No description collected.</p>';
        const commentsHtml = comments.length > 0
          ? comments.map((comment, index) => \`
              <div class="jira-comment">
                <div class="jira-ticket-field-title">Comment \${index + 1}</div>
                <pre class="jira-ticket-content">\${escapeHtml(comment)}</pre>
              </div>
            \`).join('')
          : '<p class="empty-state">No comments collected.</p>';

        return \`
          <div class="jira-ticket-section">
            <div class="jira-ticket-heading">
              <h3>Ticket content</h3>
              <span>\${escapeHtml(metaParts.join(' - '))}</span>
            </div>
            <div class="jira-ticket-field">
              <div class="jira-ticket-field-title">Title</div>
              <div class="jira-ticket-title">\${escapeHtml(ticket.title)}</div>
            </div>
            <div class="jira-ticket-field">
              <div class="jira-ticket-field-title">Description</div>
              \${descriptionHtml}
            </div>
            <div class="jira-ticket-field">
              <div class="jira-ticket-field-title">Comments</div>
              \${commentsHtml}
            </div>
          </div>
        \`;
      }

      function renderFigmaDetail(detail, activeNode) {
        const connection = taskState.figma;
        if (!figmaFormState.link && connection && connection.link) {
          figmaFormState.link = connection.link;
        }

        const isTaskLinkTab = figmaFormState.activeTab !== 'setting';
        const syncStatus = figmaFormState.message
          ? \`<p class="figma-sync-status\${figmaFormState.isError ? ' error' : ''}">\${escapeHtml(figmaFormState.message)}</p>\`
          : '';
        const connectionSummary = connection
          ? \`
            <div class="figma-connection-summary">
              <div class="figma-connection-title">\${escapeHtml(connection.fileName)}</div>
              <div class="detail-copy">\${escapeHtml(getFigmaConnectionMeta(connection))}</div>
            </div>
          \`
          : '';
        const figmaNodeList = getFigmaNodeListHtml(connection);

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(activeNode?.label || 'Figma')}</h2>
            <p class="detail-copy">Connect a Figma task link and verify access with a token.</p>
          </div>

          <div class="figma-tabs" role="tablist" aria-label="Figma connection">
            <button class="figma-tab\${isTaskLinkTab ? ' active' : ''}" type="button" role="tab" aria-selected="\${isTaskLinkTab ? 'true' : 'false'}" data-figma-tab="task-link">Task link</button>
            <button class="figma-tab\${!isTaskLinkTab ? ' active' : ''}" type="button" role="tab" aria-selected="\${!isTaskLinkTab ? 'true' : 'false'}" data-figma-tab="setting">Setting</button>
          </div>

          <div class="figma-panel\${isTaskLinkTab ? ' active' : ''}" \${isTaskLinkTab ? '' : 'hidden'}>
            <label class="form-field" for="figmaTaskLinkInput">
              <span>Figma link</span>
              <input id="figmaTaskLinkInput" type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/..." value="\${escapeHtml(figmaFormState.link)}">
            </label>
            <div class="figma-actions">
              <button id="figmaSyncBtn" type="button" \${figmaFormState.isSyncing ? 'disabled' : ''}>Sync</button>
            </div>
            \${syncStatus}
            \${connectionSummary}
          </div>

          <div class="figma-panel\${!isTaskLinkTab ? ' active' : ''}" \${!isTaskLinkTab ? '' : 'hidden'}>
            <label class="form-field" for="figmaTokenInput">
              <span>Token</span>
              <input id="figmaTokenInput" class="\${figmaFormState.highlightToken ? 'attention' : ''}" type="password" autocomplete="off" placeholder="Paste Figma token" value="\${escapeHtml(figmaFormState.token)}">
            </label>
            \${syncStatus}
          </div>

          \${figmaNodeList}
        \`;

        bindFigmaDetail();

        if (figmaFormState.highlightToken && !isTaskLinkTab) {
          setTimeout(focusFigmaTokenInput, 0);
        }
      }

      function bindFigmaDetail() {
        document.querySelectorAll('[data-figma-tab]').forEach(button => {
          button.onclick = () => {
            captureFigmaFields();
            figmaFormState.activeTab = button.dataset.figmaTab;
            figmaFormState.highlightToken = false;
            renderDetail();
          };
        });

        const linkInput = document.getElementById('figmaTaskLinkInput');
        if (linkInput) {
          linkInput.oninput = () => {
            figmaFormState.link = linkInput.value;
          };
          linkInput.onkeydown = event => {
            if (event.key === 'Enter') {
              handleFigmaSync();
            }
          };
        }

        const tokenInput = document.getElementById('figmaTokenInput');
        if (tokenInput) {
          tokenInput.oninput = () => {
            figmaFormState.token = tokenInput.value;
            if (figmaFormState.token.trim()) {
              figmaFormState.highlightToken = false;
              tokenInput.classList.remove('attention');
            }
          };
          tokenInput.onkeydown = event => {
            if (event.key === 'Enter') {
              handleFigmaSync();
            }
          };
        }

        const syncButton = document.getElementById('figmaSyncBtn');
        if (syncButton) {
          syncButton.onclick = handleFigmaSync;
        }

        document.querySelectorAll('[data-figma-node-checkbox]').forEach(checkbox => {
          checkbox.onchange = () => {
            updateFigmaNodeSelection(checkbox.dataset.figmaNodeId, checkbox.checked);
          };
        });

        document.querySelectorAll('[data-copy-figma-node-title]').forEach(button => {
          button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            copyFigmaNodeTitle(button.dataset.figmaNodeTitle);
          };
        });
      }

      function captureFigmaFields() {
        const linkInput = document.getElementById('figmaTaskLinkInput');
        const tokenInput = document.getElementById('figmaTokenInput');

        if (linkInput) {
          figmaFormState.link = linkInput.value;
        }

        if (tokenInput) {
          figmaFormState.token = tokenInput.value;
        }
      }

      function handleFigmaSync() {
        captureFigmaFields();

        if (figmaFormState.isSyncing) {
          return;
        }

        if (!figmaFormState.token.trim()) {
          figmaFormState.activeTab = 'setting';
          figmaFormState.message = 'Paste a Figma token before syncing.';
          figmaFormState.isError = true;
          figmaFormState.highlightToken = true;
          renderDetail();
          setTimeout(focusFigmaTokenInput, 0);
          return;
        }

        if (!figmaFormState.link.trim()) {
          figmaFormState.activeTab = 'task-link';
          figmaFormState.message = 'Paste a Figma link before syncing.';
          figmaFormState.isError = true;
          figmaFormState.highlightToken = false;
          renderDetail();
          setTimeout(focusFigmaLinkInput, 0);
          return;
        }

        figmaFormState.isSyncing = true;
        figmaFormState.message = 'Syncing Figma link...';
        figmaFormState.isError = false;
        figmaFormState.highlightToken = false;
        renderDetail();

        vscode.postMessage({
          command: 'syncFigmaTaskLink',
          data: getTaskRequestContext({
            link: figmaFormState.link.trim(),
            token: figmaFormState.token.trim()
          })
        });
      }

      function focusFigmaTokenInput() {
        const tokenInput = document.getElementById('figmaTokenInput');
        if (!tokenInput) {
          return;
        }

        tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tokenInput.focus();
      }

      function focusFigmaLinkInput() {
        const linkInput = document.getElementById('figmaTaskLinkInput');
        if (!linkInput) {
          return;
        }

        linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        linkInput.focus();
      }

      function getFigmaConnectionMeta(connection) {
        const parts = [];
        const nodeCount = Array.isArray(connection.nodes) ? connection.nodes.length : 0;
        const selectedCount = getSelectedFigmaNodeIds(connection).length;
        if (connection.nodeName) {
          parts.push('Node: ' + connection.nodeName);
        } else if (connection.nodeId) {
          parts.push('Node: ' + connection.nodeId);
        }

        parts.push(nodeCount + ' Figma node' + (nodeCount === 1 ? '' : 's'));
        parts.push(selectedCount + ' selected');
        parts.push('Synced: ' + formatDateTime(connection.lastSyncedAt));
        return parts.join(' - ');
      }

      function getSelectedFigmaNodeIds(connection) {
        if (!connection) {
          return [];
        }

        if (Array.isArray(connection.selectedNodeIds)) {
          return connection.selectedNodeIds;
        }

        return connection.nodeId ? [connection.nodeId] : [];
      }

      function getFigmaNodeCountLabel(totalCount, selectedCount) {
        const nodeLabel = totalCount + ' node' + (totalCount === 1 ? '' : 's');
        return selectedCount > 0
          ? nodeLabel + ' - ' + selectedCount + ' selected'
          : nodeLabel + ' - none selected';
      }

      function updateFigmaNodeSelection(nodeId, isSelected) {
        const connection = taskState.figma;
        if (!connection || !nodeId) {
          return;
        }

        const selectedNodeIds = getSelectedFigmaNodeIds(connection).filter(id => id !== nodeId);
        if (isSelected) {
          selectedNodeIds.push(nodeId);
        }

        connection.selectedNodeIds = selectedNodeIds;
        figmaFormState.message = selectedNodeIds.length + ' Figma node' + (selectedNodeIds.length === 1 ? '' : 's') + ' selected for this ' + (currentMode === 'fix-bug' ? 'bug.' : 'task.');
        figmaFormState.isError = false;
        updateFigmaNodeSelectionUi(connection);

        vscode.postMessage({
          command: 'updateFigmaNodeSelection',
          data: getTaskRequestContext({
            selectedNodeIds
          })
        });
      }

      function updateFigmaNodeSelectionUi(connection) {
        const selectedNodeIds = new Set(getSelectedFigmaNodeIds(connection));
        document.querySelectorAll('.figma-node-item').forEach(item => {
          const checkbox = item.querySelector('[data-figma-node-checkbox]');
          const isSelected = checkbox && selectedNodeIds.has(checkbox.dataset.figmaNodeId);
          if (checkbox) {
            checkbox.checked = Boolean(isSelected);
          }
          item.classList.toggle('selected', Boolean(isSelected));
        });

        const count = document.querySelector('[data-figma-node-count]');
        if (count) {
          const totalCount = connection && Array.isArray(connection.nodes) ? connection.nodes.length : 0;
          count.textContent = getFigmaNodeCountLabel(totalCount, selectedNodeIds.size);
        }

        const status = document.querySelector('[data-figma-selection-status]');
        if (status) {
          status.textContent = figmaFormState.message || '';
          status.classList.toggle('error', Boolean(figmaFormState.isError));
        }
      }

      function copyFigmaNodeTitle(title) {
        const cleanTitle = String(title || '').trim();
        if (!cleanTitle) {
          return;
        }

        vscode.postMessage({
          command: 'copyFigmaNodeTitle',
          data: {
            title: cleanTitle
          }
        });
      }

      function getFigmaNodeListHtml(connection) {
        if (!connection) {
          return \`
            <div class="figma-node-section">
              <div class="figma-node-heading">
                <h3>Figma nodes</h3>
                <span>Not synced</span>
              </div>
              <p class="empty-state">Sync a Figma link to load nodes from the file.</p>
            </div>
          \`;
        }

        const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
        const selectedNodeIds = getSelectedFigmaNodeIds(connection);
        const selectedNodeIdSet = new Set(selectedNodeIds);
        const nodeItems = nodes.length > 0
          ? nodes.map(node => {
            const depth = Math.min(Number(node.depth) || 0, 12);
            const isSelected = selectedNodeIdSet.has(node.id);
            return \`
              <div class="figma-node-item\${isSelected ? ' selected' : ''}" style="--depth: \${depth};">
                <input class="figma-node-checkbox" type="checkbox" data-figma-node-checkbox data-figma-node-id="\${escapeHtml(node.id)}" \${isSelected ? 'checked' : ''} aria-label="Select \${escapeHtml(node.name)}">
                <div class="figma-node-main">
                  <div class="figma-node-name">\${escapeHtml(node.name)}</div>
                  <div class="figma-node-path">\${escapeHtml(node.path)}</div>
                </div>
                <div class="figma-node-meta">
                  <span>\${escapeHtml(node.type)}</span>
                  <code>\${escapeHtml(node.id)}</code>
                </div>
                <button class="figma-node-copy-button" type="button" title="Copy title" aria-label="Copy title for \${escapeHtml(node.name)}" data-copy-figma-node-title data-figma-node-title="\${escapeHtml(node.name)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M8 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V7Z"></path>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            \`;
          }).join('')
          : '<p class="empty-state">No Figma nodes were returned for this file.</p>';

        return \`
          <div class="figma-node-section">
            <div class="figma-node-heading">
              <h3>Figma nodes</h3>
              <span data-figma-node-count>\${escapeHtml(getFigmaNodeCountLabel(nodes.length, selectedNodeIds.length))}</span>
            </div>
            <p class="figma-sync-status" data-figma-selection-status>\${escapeHtml(figmaFormState.message || '')}</p>
            <div class="figma-node-list">
              \${nodeItems}
            </div>
          </div>
        \`;
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

      function renderDocumentDetail(detail) {
        const copy = modeCopy[currentMode];
        const documents = taskState.documents || [];
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
          : '<p class="empty-state">No markdown documents imported yet.</p>';

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(copy.documentTitle)}</h2>
            <p class="detail-copy">\${escapeHtml(copy.documentCopy)}</p>
          </div>

          <div class="drop-zone" id="documentDropZone">
            <div>
              <div class="drop-title">Drop documents here</div>
              <div class="drop-copy">Files are converted to markdown with markitdown and saved in .project/docs.</div>
              <button type="button" id="chooseDocumentBtn">Choose files</button>
              <input type="file" id="documentFileInput" multiple hidden
                accept=".md,.markdown,.txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.htm,.csv,.json,.xml">
              <div class="upload-status" id="uploadStatus"></div>
            </div>
          </div>

          <div class="document-list">
            <h3>Imported markdown</h3>
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
        document.querySelectorAll('[data-doc-index]').forEach(button => {
          button.onclick = () => {
            const documentItem = taskState.documents[Number(button.dataset.docIndex)];
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

        setUploadStatus(\`Importing \${files.length} file\${files.length === 1 ? '' : 's'}...\`);

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
        currentMode = taskState.mode || currentMode;

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

      window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'taskManagerState') {
          applyTaskState(message.data, currentView === 'detail');
          renderShellViews();
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
      document.getElementById('taskBackBtn').onclick = showListView;

      updateModeControls();
      renderShellViews();
      requestState();
    </script>
  `;
}
