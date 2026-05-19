export function getFigmaDetailScript(): string {
  return `
function renderFigmaDetail(detail, activeNode) {
  const status = figmaFormState.status || {};
  const statusClassName = getFigmaBridgeStatusClass(status);
  const statusText = getFigmaBridgeStatusText(status);
  const itemCount = Array.isArray(figmaFormState.items) ? figmaFormState.items.length : 0;
  const metaParts = getFigmaBridgeMetaParts();
  const message = figmaFormState.message
    ? \`<p class="figma-sync-status\${figmaFormState.isError ? ' error' : ''}">\${escapeHtml(figmaFormState.message)}</p>\`
    : '';

  detail.innerHTML = \`
    <div class="detail-header">
      <h2>\${escapeHtml(activeNode?.label || 'Figma')}</h2>
      <p class="detail-copy">Local Figma bridge at ws://localhost:8080.</p>
    </div>

    <div class="figma-bridge-toolbar">
      <div class="figma-bridge-status">
        <span class="figma-status-dot \${escapeHtml(statusClassName)}" aria-hidden="true"></span>
        <div class="figma-bridge-status-main">
          <div class="figma-bridge-status-title">\${escapeHtml(statusText)}</div>
          <div class="detail-copy">\${escapeHtml(status.url || 'ws://localhost:8080')}\${status.connected ? ' - client connected' : ''}</div>
        </div>
      </div>
      <div class="figma-actions">
        <button type="button" data-figma-bridge-action="start" \${figmaFormState.isLoading ? 'disabled' : ''}>Start</button>
        <button type="button" data-figma-bridge-action="show" \${figmaFormState.isLoading ? 'disabled' : ''}>Show</button>
        <button type="button" data-figma-bridge-action="stop" \${figmaFormState.isLoading ? 'disabled' : ''}>Stop</button>
      </div>
    </div>

    \${message}

    <div class="figma-node-section">
      <div class="figma-node-heading">
        <h3>Received items</h3>
        <span>\${escapeHtml(itemCount + ' item' + (itemCount === 1 ? '' : 's'))}</span>
      </div>
      \${metaParts.length > 0 ? '<div class="figma-context-meta">' + metaParts.map(part => '<span>' + escapeHtml(part) + '</span>').join('') + '</div>' : ''}
      \${getFigmaBridgeItemListHtml()}
    </div>
  \`;

  bindFigmaDetail();

  if (!figmaFormState.hasRequestedState) {
    figmaFormState.hasRequestedState = true;
    figmaFormState.isLoading = true;
    vscode.postMessage({ command: 'getFigmaBridgeDetail' });
  }
}

function bindFigmaDetail() {
  document.querySelectorAll('[data-figma-bridge-action]').forEach(button => {
    button.onclick = () => {
      handleFigmaBridgeAction(button.dataset.figmaBridgeAction);
    };
  });
}

function handleFigmaBridgeAction(action) {
  const commands = {
    start: 'startFigmaMcpBridge',
    show: 'showFigmaMcpBridgeStatus',
    stop: 'stopFigmaMcpBridge'
  };
  const command = commands[action];

  if (!command || figmaFormState.isLoading) {
    return;
  }

  figmaFormState.isLoading = true;
  figmaFormState.isError = false;
  figmaFormState.message = getFigmaBridgeActionMessage(action);
  renderDetail();

  vscode.postMessage({ command });
}

function getFigmaBridgeActionMessage(action) {
  if (action === 'start') {
    return 'Starting Figma bridge...';
  }

  if (action === 'stop') {
    return 'Stopping Figma bridge...';
  }

  return 'Refreshing Figma bridge status...';
}

function applyFigmaBridgeDetail(data) {
  const detail = data || {};
  figmaFormState.status = detail.status || figmaFormState.status;
  figmaFormState.items = Array.isArray(detail.items) ? detail.items : [];
  figmaFormState.receivedAt = detail.receivedAt || '';
  figmaFormState.fileName = detail.fileName || '';
  figmaFormState.fileKey = detail.fileKey || '';
  figmaFormState.pageName = detail.pageName || '';
  figmaFormState.contextPath = detail.contextPath || '';
  figmaFormState.isLoading = false;
  figmaFormState.isError = false;
  figmaFormState.message = getFigmaBridgeLoadedMessage();
}

function failFigmaBridgeDetail(message) {
  figmaFormState.isLoading = false;
  figmaFormState.isError = true;
  figmaFormState.message = message || 'Unable to load Figma bridge status.';
}

function getFigmaBridgeLoadedMessage() {
  const status = figmaFormState.status || {};

  if (!status.running) {
    return 'Figma bridge is stopped.';
  }

  if (figmaFormState.receivedAt) {
    return 'Latest Figma payload received ' + formatDateTime(figmaFormState.receivedAt) + '.';
  }

  return status.connected
    ? 'Figma plugin is connected. Waiting for a selection payload.'
    : 'Figma bridge is running. Waiting for a Figma plugin connection.';
}

function getFigmaBridgeStatusClass(status) {
  if (status && status.running && status.connected) {
    return 'connected';
  }

  if (status && status.running) {
    return 'running';
  }

  return 'stopped';
}

function getFigmaBridgeStatusText(status) {
  if (status && status.running && status.connected) {
    return 'Running';
  }

  if (status && status.running) {
    return 'Running';
  }

  return 'Stopped';
}

function getFigmaBridgeMetaParts() {
  const parts = [];

  if (figmaFormState.fileName) {
    parts.push('File: ' + figmaFormState.fileName);
  }

  if (figmaFormState.pageName) {
    parts.push('Page: ' + figmaFormState.pageName);
  }

  if (figmaFormState.fileKey) {
    parts.push('Key: ' + figmaFormState.fileKey);
  }

  if (figmaFormState.receivedAt) {
    parts.push('Received: ' + formatDateTime(figmaFormState.receivedAt));
  }

  return parts;
}

function getFigmaBridgeItemListHtml() {
  const items = Array.isArray(figmaFormState.items) ? figmaFormState.items : [];

  if (items.length === 0) {
    return '<p class="empty-state">No Figma items have been received yet.</p>';
  }

  return \`
    <div class="figma-node-list">
      \${items.map(item => {
        const meta = getFigmaBridgeItemMeta(item);
        return \`
          <div class="figma-node-item figma-bridge-item">
            <div class="figma-node-main">
              <div class="figma-node-name">\${escapeHtml(item.name || item.id || 'Untitled node')}</div>
              <div class="figma-node-path">\${escapeHtml(meta)}</div>
            </div>
            <div class="figma-node-meta">
              <span>\${escapeHtml(item.type || 'NODE')}</span>
              \${item.id ? '<code>' + escapeHtml(item.id) + '</code>' : ''}
            </div>
          </div>
        \`;
      }).join('')}
    </div>
  \`;
}

function getFigmaBridgeItemMeta(item) {
  const parts = [];

  if (item.parentName) {
    parts.push('Parent: ' + item.parentName);
  }

  if (item.width !== undefined && item.height !== undefined) {
    parts.push(String(Math.round(Number(item.width))) + ' x ' + String(Math.round(Number(item.height))));
  }

  return parts.join(' - ');
}
  `;
}
