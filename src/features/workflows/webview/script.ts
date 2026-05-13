export const workflowScript = `
const vscode = acquireVsCodeApi();
let state = { workflows: [], activeId: null, selectedLocator: null };
let coreSettings = { hasFigmaToken: false, savePaths: [], cliStatuses: [] };

const STEP_ICONS = {
  collect_document: '📄',
  collect_figma: '🎨',
  collect_jira: '🧷',
  review_human: '👤',
  unit_test: '🧪',
  automation_test: '🤖',
  auto_commit: '⬆',
  custom: '✨'
};

function send(command, data) {
  vscode.postMessage({ command, data });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function setCoreStatus(id, message, isError) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = message || '';
  el.classList.toggle('error', Boolean(isError));
}

function setFigmaTokenStatus() {
  const status = coreSettings.hasFigmaToken
    ? 'Figma token is saved in VS Code secret storage.'
    : 'No Figma token is saved.';
  setCoreStatus('figma-token-status', status, false);
}

function renderSavePathList() {
  const list = document.getElementById('save-path-list');
  if (!list) {
    return;
  }
  if (!Array.isArray(coreSettings.savePaths) || coreSettings.savePaths.length === 0) {
    list.innerHTML = '<p class="field-status">No save paths are available.</p>';
    return;
  }

  list.innerHTML = coreSettings.savePaths.map(pathSetting => {
    const editable = Boolean(pathSetting.editable);
    const readonlyAttr = editable ? '' : ' readonly';
    const configMeta = pathSetting.configKey
      ? \`<p class="save-path-meta">Config key: <code>\${escapeHtml(pathSetting.configKey)}</code></p>\`
      : '';
    const actions = editable
      ? \`
        <button class="btn" type="button" data-save-path-action="save" data-save-path-id="\${escapeHtml(pathSetting.id)}">Save</button>
        <button class="btn secondary" type="button" data-save-path-action="reset" data-save-path-id="\${escapeHtml(pathSetting.id)}">Reset</button>
      \`
      : '';

    return \`
      <div class="save-path-row">
        <label class="save-path-title" for="save-path-\${escapeHtml(pathSetting.id)}">\${escapeHtml(pathSetting.label)}</label>
        <p class="save-path-description">\${escapeHtml(pathSetting.description)}</p>
        <div class="save-path-control">
          <input id="save-path-\${escapeHtml(pathSetting.id)}" data-save-path-input="\${escapeHtml(pathSetting.id)}" type="text" value="\${escapeHtml(pathSetting.value)}"\${readonlyAttr} />
          \${actions}
        </div>
        <p class="save-path-meta">Default: <code>\${escapeHtml(pathSetting.defaultValue)}</code></p>
        \${configMeta}
      </div>
    \`;
  }).join('');
}

function renderCoreSettings() {
  setFigmaTokenStatus();
  renderCliStatusList();
  renderSavePathList();
}

function getCliCardClass(status) {
  if (!status.installed) {
    return 'error';
  }

  return status.authenticated ? 'success' : 'warning';
}

function getCliStatusLabel(status) {
  if (!status.installed) {
    return 'Not installed';
  }

  return status.authenticated ? 'Authenticated' : 'Needs auth';
}

function renderCliStatusList() {
  const list = document.getElementById('cli-status-list');
  if (!list) {
    return;
  }

  if (!Array.isArray(coreSettings.cliStatuses) || coreSettings.cliStatuses.length === 0) {
    list.innerHTML = '<p class="field-status">CLI status is not available.</p>';
    return;
  }

  list.innerHTML = coreSettings.cliStatuses.map(status => {
    const cardClass = getCliCardClass(status);
    const version = status.version ? \`<p class="cli-status-meta">\${escapeHtml(status.version)}</p>\` : '';
    const message = status.message ? \`<p class="cli-status-message">\${escapeHtml(status.message)}</p>\` : '';
    const actions = !status.installed
      ? \`<button class="btn" type="button" data-cli-action="install" data-cli-id="\${escapeHtml(status.id)}">Run Init env</button>\`
      : status.authenticated
        ? ''
        : \`<button class="btn" type="button" data-cli-action="authenticate" data-cli-id="\${escapeHtml(status.id)}">Authenticate</button>\`;
    const actionHtml = actions
      ? \`<div class="cli-status-actions">\${actions}</div>\`
      : '';

    return \`
      <div class="cli-status-card \${cardClass}">
        <div class="cli-status-top">
          <div>
            <p class="cli-status-title">\${escapeHtml(status.label)}</p>
            \${version}
          </div>
          <span class="status-pill \${cardClass}">\${escapeHtml(getCliStatusLabel(status))}</span>
        </div>
        \${message}
        \${actionHtml}
      </div>
    \`;
  }).join('');
}

function getSavePathInputValue(pathId) {
  const input = document.querySelector(\`[data-save-path-input="\${CSS.escape(pathId)}"]\`);
  return input ? input.value : '';
}

function setActiveCoreNav(sectionId) {
  document.querySelectorAll('[data-core-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.coreNav === sectionId);
  });
}

function bindCoreSettings() {
  const saveTokenButton = document.getElementById('save-figma-token');
  const clearTokenButton = document.getElementById('clear-figma-token');
  const refreshCliButton = document.getElementById('refresh-cli-status');

  if (saveTokenButton) {
    saveTokenButton.addEventListener('click', () => {
      const input = document.getElementById('figma-access-token');
      const token = input ? input.value : '';
      if (!token.trim()) {
        setCoreStatus('figma-token-status', 'Paste a Figma access token before saving.', true);
        return;
      }
      send('saveFigmaToken', { token });
      setCoreStatus('figma-token-status', 'Saving Figma token...', false);
    });
  }

  if (clearTokenButton) {
    clearTokenButton.addEventListener('click', () => {
      send('clearFigmaToken', {});
      setCoreStatus('figma-token-status', 'Clearing Figma token...', false);
    });
  }

  if (refreshCliButton) {
    refreshCliButton.addEventListener('click', () => {
      send('refreshCliStatus', {});
      setCoreStatus('cli-status-status', 'Refreshing CLI status...', false);
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) {
      return;
    }

    const navLink = target.closest('[data-core-nav]');
    if (navLink) {
      const section = document.getElementById(navLink.dataset.coreNav);
      if (section) {
        event.preventDefault();
        setActiveCoreNav(navLink.dataset.coreNav);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const actionButton = target.closest('[data-save-path-action]');
    if (actionButton) {
      const pathId = actionButton.dataset.savePathId;
      if (actionButton.dataset.savePathAction === 'save') {
        send('saveTaskDocumentsFolder', { value: getSavePathInputValue(pathId) });
        setCoreStatus('save-path-status', 'Saving path...', false);
        return;
      }

      if (actionButton.dataset.savePathAction === 'reset') {
        send('resetTaskDocumentsFolder', {});
        setCoreStatus('save-path-status', 'Resetting path...', false);
      }
      return;
    }

    const cliButton = target.closest('[data-cli-action]');
    if (!cliButton) {
      return;
    }

    if (cliButton.dataset.cliAction === 'install') {
      send('installCli', { id: cliButton.dataset.cliId });
      setCoreStatus('cli-status-status', 'Starting Init env...', false);
      return;
    }

    if (cliButton.dataset.cliAction === 'authenticate') {
      send('authenticateCli', { id: cliButton.dataset.cliId });
      setCoreStatus('cli-status-status', 'Opening authentication terminal...', false);
    }
  });
}

function activeWorkflow() {
  return state.workflows.find(w => w.id === state.activeId) || null;
}

function locatorKey(locator) {
  return locator ? JSON.stringify(locator) : '';
}

function locatorAttr(locator) {
  return escapeHtml(locatorKey(locator));
}

function isSelectedLocator(locator) {
  return locatorKey(state.selectedLocator) === locatorKey(locator);
}

function renderWorkflowList() {
  const list = document.getElementById('workflow-list');
  if (state.workflows.length === 0) {
    list.innerHTML = '<div class="workflow-list-empty">No workflows yet. Click + to add one.</div>';
    return;
  }
  list.innerHTML = state.workflows.map(w => \`
    <div class="workflow-item \${w.id === state.activeId ? 'active' : ''}" data-id="\${escapeHtml(w.id)}">
      <span class="name" title="\${escapeHtml(w.name)}">\${escapeHtml(w.name)}</span>
      <div class="actions">
        <button class="icon-btn" data-action="rename" title="Rename">✎</button>
        <button class="icon-btn danger" data-action="delete" title="Delete">🗑</button>
      </div>
    </div>
  \`).join('');
}

function renderStepCard(step, locator, insertLocator, handleClass) {
  const icon = STEP_ICONS[step.stepType] || '•';
  const selectedClass = isSelectedLocator(locator) ? ' selected' : '';
  const status = step.status || 'idle';
  const insertBtn = \`<button class="insert-handle \${handleClass}" data-action="insert-before" data-locator='\${locatorAttr(insertLocator)}' title="Insert step before">+</button>\`;
  return \`
    <div class="block-wrap\${selectedClass}" data-block-locator='\${locatorAttr(locator)}'>
      \${insertBtn}
      <div class="block-card status-\${escapeHtml(status)}" data-locator='\${locatorAttr(locator)}'>
        <div class="block-icon">\${icon}</div>
        <button class="block-delete" data-action="delete-block" title="Delete">×</button>
      </div>
      <div class="block-label" title="\${escapeHtml(step.title)}">\${escapeHtml(step.title)}</div>
    </div>
  \`;
}

function renderParallel(block, index) {
  const children = block.children.map((c, ci) => {
    const childLocator = { type: 'parallel-child', parentIndex: index, childIndex: ci };
    const insertLocator = { type: 'parallel-child', parentIndex: index, childIndex: ci - 1 };
    return renderStepCard(c, childLocator, insertLocator, 'left');
  }).join('');
  const rootLocator = { type: 'root', index };
  const insertLocator = { type: 'root', index: index - 1 };
  const selectedClass = isSelectedLocator(rootLocator) ? ' selected' : '';
  const status = block.status || 'idle';
  return \`
    <div class="block-wrap\${selectedClass}" style="width: auto;" data-block-locator='\${locatorAttr(rootLocator)}'>
      <button class="insert-handle top" data-action="insert-before" data-locator='\${locatorAttr(insertLocator)}' title="Insert step before">+</button>
      <div class="parallel-group status-\${escapeHtml(status)}" data-locator='\${locatorAttr(rootLocator)}'>
        <button class="block-delete" data-action="delete-block" title="Delete group">×</button>
        <div class="parallel-header">⏸ Parallel</div>
        <div class="parallel-children">\${children}</div>
        <button class="btn secondary parallel-add-child" data-action="add-parallel-child" data-parent-index="\${index}">+ Add branch</button>
      </div>
      <div class="block-label" title="\${escapeHtml(block.title)}">\${escapeHtml(block.title)}</div>
      <div class="block-sublabel">parallel · \${block.children.length} branches</div>
    </div>
  \`;
}

function renderBlock(block, index) {
  if (block.kind === 'step') {
    return renderStepCard(
      block,
      { type: 'root', index },
      { type: 'root', index: index - 1 },
      'top'
    );
  }
  return renderParallel(block, index);
}

function renderAddAfter(locator) {
  return \`
    <div class="add-after-wrap">
      <button class="add-after" data-action="add-after" data-locator='\${locatorAttr(locator)}' title="Add next step">+</button>
    </div>
  \`;
}

function renderTree() {
  const wf = activeWorkflow();
  const canvas = document.getElementById('canvas-body');
  if (!wf) {
    canvas.innerHTML = '<div class="tree-empty">Select or create a workflow.</div>';
    document.getElementById('canvas-actions').style.visibility = 'hidden';
    return;
  }
  document.getElementById('canvas-title').value = wf.name;
  document.getElementById('canvas-actions').style.visibility = 'visible';

  const parts = [];
  wf.blocks.forEach((b, i) => {
    if (i > 0) {
      parts.push('<div class="connector"></div>');
    }
    parts.push(renderBlock(b, i));
  });
  if (wf.blocks.length > 0) {
    parts.push('<div class="connector"></div>');
  }
  parts.push(renderAddAfter({ type: 'root', index: wf.blocks.length - 1 }));

  canvas.innerHTML = \`<div class="tree">\${parts.join('')}</div>\`;
}

function render() {
  renderWorkflowList();
  renderTree();
}

document.addEventListener('click', e => {
  const target = e.target instanceof Element ? e.target : e.target.parentElement;
  if (!target) {
    return;
  }
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === 'rename') {
      const itemEl = actionEl.closest('.workflow-item');
      send('renameWorkflow', { id: itemEl.dataset.id });
      e.stopPropagation();
      return;
    }
    if (action === 'delete') {
      const itemEl = actionEl.closest('.workflow-item');
      send('deleteWorkflow', { id: itemEl.dataset.id });
      e.stopPropagation();
      return;
    }
    if (action === 'add-after' || action === 'insert-before') {
      const locator = JSON.parse(actionEl.dataset.locator);
      send('addStep', { workflowId: state.activeId, locator });
      e.stopPropagation();
      return;
    }
    if (action === 'delete-block') {
      const blockEl = actionEl.closest('[data-locator]');
      const locator = JSON.parse(blockEl.dataset.locator);
      send('deleteBlock', { workflowId: state.activeId, locator });
      e.stopPropagation();
      return;
    }
    if (action === 'add-parallel-child') {
      const parentIndex = Number(actionEl.dataset.parentIndex);
      send('addParallelChild', { workflowId: state.activeId, parentIndex });
      e.stopPropagation();
      return;
    }
  }
  const blockWrap = target.closest('[data-block-locator]');
  if (blockWrap) {
    state.selectedLocator = JSON.parse(blockWrap.dataset.blockLocator);
    renderTree();
    return;
  }
  const workflowEl = target.closest('.workflow-item');
  if (workflowEl) {
    const id = workflowEl.dataset.id;
    if (id !== state.activeId) {
      state.activeId = id;
      state.selectedLocator = null;
      send('selectWorkflow', { id });
      render();
    }
    return;
  }
});

document.getElementById('new-workflow').addEventListener('click', () => {
  send('createWorkflow', {});
});
document.getElementById('canvas-title').addEventListener('change', e => {
  send('renameWorkflowInline', { id: state.activeId, name: e.target.value });
});
document.getElementById('validate-workflow').addEventListener('click', () => {
  send('validateWorkflow', { id: state.activeId });
});
document.getElementById('import-workflow').addEventListener('click', () => {
  send('importWorkflow', {});
});
document.getElementById('export-workflow').addEventListener('click', () => {
  send('exportWorkflow', { id: state.activeId });
});
document.getElementById('add-parallel').addEventListener('click', () => {
  send('addParallelGroup', { workflowId: state.activeId });
});

let zoom = 1;
function applyZoom() {
  const body = document.getElementById('canvas-body');
  if (body) {
    body.style.zoom = String(zoom);
  }
  const label = document.getElementById('zoom-level');
  if (label) {
    label.textContent = Math.round(zoom * 100) + '%';
  }
}
document.getElementById('zoom-in').addEventListener('click', () => {
  zoom = Math.min(2, Math.round((zoom + 0.1) * 10) / 10);
  applyZoom();
});
document.getElementById('zoom-out').addEventListener('click', () => {
  zoom = Math.max(0.3, Math.round((zoom - 0.1) * 10) / 10);
  applyZoom();
});
document.getElementById('zoom-reset').addEventListener('click', () => {
  zoom = 1;
  applyZoom();
});

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-' + t.dataset.tab).classList.add('active');
  });
});

bindCoreSettings();

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.command === 'setState') {
    const incoming = msg.data;
    const previousActiveId = state.activeId;
    state.workflows = incoming.workflows || [];
    if (incoming.activeId !== undefined) {
      state.activeId = incoming.activeId;
    }
    if (state.activeId && !state.workflows.find(w => w.id === state.activeId)) {
      state.activeId = state.workflows[0] ? state.workflows[0].id : null;
    }
    if (!state.activeId && state.workflows.length > 0) {
      state.activeId = state.workflows[0].id;
    }
    if (previousActiveId !== state.activeId) {
      state.selectedLocator = null;
    }
    render();
  } else if (msg.command === 'setCoreSettings') {
    coreSettings = msg.data || coreSettings;
    renderCoreSettings();
  } else if (msg.command === 'coreSettingsSaved') {
    coreSettings = msg.data || coreSettings;
    renderCoreSettings();
    const input = document.getElementById('figma-access-token');
    if (input && msg.statusId === 'figma-token-status') {
      input.value = '';
    }
    setCoreStatus(msg.statusId || 'save-path-status', msg.message || 'Settings saved.', false);
  } else if (msg.command === 'coreSettingsError') {
    setCoreStatus(msg.statusId || 'save-path-status', msg.message || 'Settings update failed.', true);
  }
});

send('ready', {});
`;
