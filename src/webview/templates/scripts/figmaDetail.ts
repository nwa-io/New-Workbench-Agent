export function getFigmaDetailScript(): string {
  return `
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
  const savedTokenStatus = integrationState.hasFigmaToken
    ? '<p class="figma-sync-status">Saved Figma token available from NWA Settings.</p>'
    : '';
  const tokenPlaceholder = integrationState.hasFigmaToken
    ? 'Saved token available; paste to override'
    : 'Paste Figma token';
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
        <input id="figmaTokenInput" class="\${figmaFormState.highlightToken ? 'attention' : ''}" type="password" autocomplete="off" placeholder="\${escapeHtml(tokenPlaceholder)}" value="\${escapeHtml(figmaFormState.token)}">
      </label>
      \${savedTokenStatus}
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
  figmaFormState.message = selectedNodeIds.length + ' Figma node' + (selectedNodeIds.length === 1 ? '' : 's') + ' selected for this ' + itemTypeText(getActiveItemType()) + '.';
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
  `;
}
