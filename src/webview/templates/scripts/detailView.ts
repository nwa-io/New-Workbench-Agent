export function getDetailViewScript(): string {
  return `
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
    createFlowNode('document', 44, 72, 238, 96, 'wide', getActiveModeCopy().documentTitle || 'Document', documentCount > 0 ? documentCount + ' markdown file' + (documentCount === 1 ? '' : 's') : 'Drop SRS, PDF, notes'),
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
  `;
}
