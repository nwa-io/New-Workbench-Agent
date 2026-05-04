import { TaskManagerMode } from '../../models/TaskManager';

export function getTaskScriptContent(initialMode: TaskManagerMode): string {
  return `
    <script>
      const vscode = acquireVsCodeApi();
      const initialMode = ${JSON.stringify(initialMode)};

      let currentMode = initialMode;
      let selectedNodeId = 'document';
      let taskState = {
        mode: currentMode,
        documentsFolder: '',
        documents: [],
        nodes: []
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
          data: { mode: currentMode }
        });
      }

      function setMode(mode) {
        currentMode = mode;
        updateModeControls();
        renderDetail();
        vscode.postMessage({
          command: 'setTaskMode',
          data: { mode }
        });
      }

      function updateModeControls() {
        document.getElementById('taskModeTask').classList.toggle('active', currentMode === 'task');
        document.getElementById('taskModeFixBug').classList.toggle('active', currentMode === 'fix-bug');
        document.getElementById('taskModeSummary').textContent = modeCopy[currentMode].summary;
      }

      function renderTree() {
        const tree = document.getElementById('taskTree');
        tree.innerHTML = '';

        const nodes = taskState.nodes.length > 0 ? taskState.nodes : [
          { id: 'document', label: 'Document', status: 'Unknown' },
          { id: 'figma', label: 'Figma', status: 'Un-sync' },
          { id: 'jira', label: 'Jira', status: 'Un-sync' },
          { id: 'code', label: 'Code', status: 'Unknown' },
          { id: 'testcase', label: 'Testcase', status: 'Unknown' }
        ];

        const nodeLookup = nodes.reduce((lookup, node) => {
          lookup[node.id] = node;
          return lookup;
        }, {});
        const documentCount = (taskState.documents || []).length;
        const flowNodes = [
          createFlowNode('document', 44, 72, 238, 96, 'wide', currentMode === 'fix-bug' ? 'Bug Document' : 'Document', documentCount > 0 ? documentCount + ' markdown file' + (documentCount === 1 ? '' : 's') : 'Drop SRS, PDF, notes'),
          createFlowNode('figma', 342, 72, 112, 96, 'square', 'Figma', 'Design sync'),
          createFlowNode('jira', 532, 72, 112, 96, 'square', 'Jira', 'Issue sync'),
          createFlowNode('code', 198, 250, 112, 112, 'circle', 'Code', 'Later'),
          createFlowNode('testcase', 408, 250, 112, 112, 'circle', 'Testcase', 'Later')
        ];

        tree.innerHTML = getFlowCanvasShell();
        const canvas = tree.querySelector('.flow-canvas');

        flowNodes.forEach(node => {
          const sourceNode = nodeLookup[node.id] || { id: node.id, label: node.title, status: 'Unknown' };
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
          button.className = 'flow-node ' + node.type + (node.id === selectedNodeId ? ' selected' : '');
          button.dataset.nodeId = node.id;
          button.style.setProperty('--x', node.x + 'px');
          button.style.setProperty('--y', node.y + 'px');
          button.style.setProperty('--w', node.width + 'px');
          button.style.setProperty('--h', node.height + 'px');
          button.setAttribute('aria-label', sourceNode.label + ', status ' + sourceNode.status);
          button.innerHTML = getFlowNodeHtml(node, sourceNode.status);
          button.onclick = () => {
            selectedNodeId = node.id;
            renderTree();
            renderDetail();
          };
          canvas.appendChild(button);
        });
      }

      function createFlowNode(id, x, y, width, height, type, title, meta) {
        return { id, x, y, width, height, type, title, meta };
      }

      function getFlowCanvasShell() {
        return \`
          <div class="flow-canvas">
            <svg class="flow-connectors" viewBox="0 0 700 390" aria-hidden="true">
              <defs>
                <marker id="flowArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path class="flow-arrow" d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              </defs>
              <path class="flow-line" d="M 282 120 L 342 120" marker-end="url(#flowArrow)"></path>
              <path class="flow-line" d="M 454 120 L 532 120" marker-end="url(#flowArrow)"></path>
              <path class="flow-line" d="M 644 120 L 676 120" marker-end="url(#flowArrow)"></path>
              <path class="flow-line dashed" d="M 164 168 C 164 206 254 206 254 250"></path>
              <path class="flow-line dashed" d="M 232 168 C 282 218 462 206 462 250"></path>
            </svg>
            <span class="flow-plus" style="--x: 672px; --y: 108px;" aria-hidden="true">+</span>
            <span class="flow-plus" style="--x: 152px; --y: 194px;" aria-hidden="true">+</span>
            <span class="flow-plus" style="--x: 251px; --y: 208px;" aria-hidden="true">+</span>
            <span class="flow-plus" style="--x: 460px; --y: 208px;" aria-hidden="true">+</span>
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

        detail.innerHTML = \`
          <div class="detail-header">
            <h2>\${escapeHtml(activeNode?.label || selectedNodeId)}</h2>
            <p class="detail-copy">This source will be connected in a later step.</p>
          </div>
          <p class="empty-state">Current status: \${escapeHtml(activeNode?.status || 'Unknown')}</p>
        \`;
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
          data: {
            link: jiraFormState.link.trim(),
            mode: currentMode
          }
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
          data: {
            link: jiraFormState.link.trim(),
            mode: currentMode
          }
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
        const metaParts = [];
        if (ticket.key) {
          metaParts.push(ticket.key);
        }
        if (ticket.status) {
          metaParts.push(ticket.status);
        }
        metaParts.push('Read: ' + formatDateTime(ticket.lastReadAt));

        return \`
          <div class="jira-ticket-section">
            <div class="jira-ticket-heading">
              <h3>Ticket content</h3>
              <span>\${escapeHtml(metaParts.join(' - '))}</span>
            </div>
            <div class="jira-ticket-summary">
              <div class="jira-ticket-title">\${escapeHtml(ticket.summary || ticket.title)}</div>
              <div class="detail-copy">\${escapeHtml(ticket.url)}</div>
            </div>
            <pre class="jira-ticket-content">\${escapeHtml(ticket.content)}</pre>
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
          data: {
            link: figmaFormState.link.trim(),
            token: figmaFormState.token.trim(),
            mode: currentMode
          }
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
        if (connection.nodeName) {
          parts.push('Node: ' + connection.nodeName);
        } else if (connection.nodeId) {
          parts.push('Node: ' + connection.nodeId);
        }

        parts.push(nodeCount + ' top-level Figma node' + (nodeCount === 1 ? '' : 's'));
        parts.push('Synced: ' + formatDateTime(connection.lastSyncedAt));
        return parts.join(' - ');
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
        const nodeItems = nodes.length > 0
          ? nodes.map(node => {
            const depth = Math.min(Number(node.depth) || 0, 12);
            const isSelected = connection.nodeId && node.id === connection.nodeId;
            return \`
              <div class="figma-node-item\${isSelected ? ' selected' : ''}" style="--depth: \${depth};">
                <div class="figma-node-main">
                  <div class="figma-node-name">\${escapeHtml(node.name)}</div>
                  <div class="figma-node-path">\${escapeHtml(node.path)}</div>
                </div>
                <div class="figma-node-meta">
                  <span>\${escapeHtml(node.type)}</span>
                  <code>\${escapeHtml(node.id)}</code>
                </div>
              </div>
            \`;
          }).join('')
          : '<p class="empty-state">No Figma nodes were returned for this file.</p>';

        return \`
          <div class="figma-node-section">
            <div class="figma-node-heading">
              <h3>Figma nodes</h3>
              <span>\${nodes.length} top-level node\${nodes.length === 1 ? '' : 's'}</span>
            </div>
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
              <div class="drop-copy">Files are converted to markdown with markitdown and saved in the default task folder.</div>
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
              data: {
                fileName: file.name,
                contentBase64,
                mode: currentMode
              }
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

      window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'taskManagerState') {
          taskState = message.data;
          currentMode = taskState.mode || currentMode;
          updateModeControls();
          document.getElementById('taskDocumentsFolder').textContent = \`Documents: \${taskState.documentsFolder || '-'}\`;
          renderTree();
          renderDetail();
        } else if (message.command === 'taskDocumentUploadComplete') {
          taskState = message.data.state;
          currentMode = taskState.mode || currentMode;
          updateModeControls();
          document.getElementById('taskDocumentsFolder').textContent = \`Documents: \${taskState.documentsFolder || '-'}\`;
          renderTree();
          renderDetail();
          setUploadStatus(\`Saved \${message.data.document.name}\`);
        } else if (message.command === 'taskDocumentUploadFailed') {
          setUploadStatus(message.data.message || 'Document import failed.', true);
        } else if (message.command === 'figmaTaskLinkSyncComplete') {
          taskState = message.data.state;
          currentMode = taskState.mode || currentMode;
          figmaFormState.isSyncing = false;
          figmaFormState.isError = false;
          figmaFormState.highlightToken = false;
          figmaFormState.activeTab = 'task-link';
          figmaFormState.link = message.data.connection.link || figmaFormState.link;
          figmaFormState.message = 'Connected to ' + message.data.connection.fileName + '.';
          updateModeControls();
          document.getElementById('taskDocumentsFolder').textContent = \`Documents: \${taskState.documentsFolder || '-'}\`;
          renderTree();
          renderDetail();
        } else if (message.command === 'figmaTaskLinkSyncFailed') {
          figmaFormState.isSyncing = false;
          figmaFormState.isError = true;
          figmaFormState.message = message.data.message || 'Figma sync failed.';
          renderDetail();
        } else if (message.command === 'jiraOpenComplete') {
          taskState = message.data.state;
          currentMode = taskState.mode || currentMode;
          jiraFormState.isOpening = false;
          jiraFormState.isReading = false;
          jiraFormState.isError = false;
          jiraFormState.link = message.data.connection.link || jiraFormState.link;
          jiraFormState.message = 'Chrome opened. Log in to Jira there if needed, then click Read ticket.';
          updateModeControls();
          document.getElementById('taskDocumentsFolder').textContent = \`Documents: \${taskState.documentsFolder || '-'}\`;
          renderTree();
          renderDetail();
        } else if (message.command === 'jiraOpenFailed') {
          jiraFormState.isOpening = false;
          jiraFormState.isReading = false;
          jiraFormState.isError = true;
          jiraFormState.message = message.data.message || 'Jira open failed.';
          renderDetail();
        } else if (message.command === 'jiraReadComplete') {
          taskState = message.data.state;
          currentMode = taskState.mode || currentMode;
          jiraFormState.isOpening = false;
          jiraFormState.isReading = false;
          jiraFormState.isError = false;
          jiraFormState.link = message.data.connection.link || jiraFormState.link;
          jiraFormState.message = 'Read Jira ticket content. Playwright Chrome closed.';
          updateModeControls();
          document.getElementById('taskDocumentsFolder').textContent = \`Documents: \${taskState.documentsFolder || '-'}\`;
          renderTree();
          renderDetail();
        } else if (message.command === 'jiraReadFailed') {
          jiraFormState.isOpening = false;
          jiraFormState.isReading = false;
          jiraFormState.isError = true;
          jiraFormState.message = message.data.message || 'Jira read failed.';
          renderDetail();
        } else if (message.command === 'taskModeChanged') {
          currentMode = message.data.mode;
          updateModeControls();
          renderDetail();
        }
      });

      document.getElementById('taskModeTask').onclick = () => setMode('task');
      document.getElementById('taskModeFixBug').onclick = () => setMode('fix-bug');
      document.getElementById('taskCloseBtn').onclick = () => vscode.postMessage({ command: 'cancel' });

      updateModeControls();
      renderTree();
      renderDetail();
      requestState();
    </script>
  `;
}
