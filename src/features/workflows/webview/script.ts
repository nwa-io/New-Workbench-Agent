export const workflowScript = `
const vscode = acquireVsCodeApi();
let state = { workflows: [], activeId: null, selectedLocator: null };

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
  }
});

send('ready', {});
`;
