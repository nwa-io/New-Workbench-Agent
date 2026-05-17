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
  workflowRunState.status = 'idle';
  workflowRunState.pendingRun = false;
  workflowRunState.message = '';
  workflowRunState.errorTooltips = {};
}

function renderTree() {
  const tree = document.getElementById('taskTree');
  if (!tree) {
    return;
  }

  bindTaskTreeZoomControls();

  const workflow = getActiveTaskWorkflow();
  const blocks = workflow && Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const title = workflow?.name || currentItem?.summary?.workflowName || 'Task workflow';
  const fileName = workflow?.fileName || 'workflow.yaml';

  if (blocks.length === 0) {
    tree.innerHTML = getWorkflowDetailCanvasShell(
      title,
      fileName,
      '<div class="workflow-detail-empty">No workflow steps found for this item.</div>'
    );
    applyTaskTreeZoom();
    bindWorkflowDetailActions();
    return;
  }

  const parts = [];
  blocks.forEach((block, index) => {
    if (index > 0) {
      parts.push('<div class="workflow-detail-connector"></div>');
    }
    parts.push(getWorkflowDetailBlockHtml(block, { type: 'root', index }));
  });

  tree.innerHTML = getWorkflowDetailCanvasShell(
    title,
    fileName,
    '<div class="workflow-detail-tree">' + parts.join('') + '</div>'
  );

  applyTaskTreeZoom();
  bindWorkflowDetailTree();
  bindWorkflowDetailActions();
}

function getActiveTaskWorkflow() {
  if (taskState.currentWorkflow) {
    return taskState.currentWorkflow;
  }

  const item = currentItem || taskState.currentItem;
  const workflows = Array.isArray(taskState.workflows) ? taskState.workflows : [];
  const matchedWorkflow = item?.workflowId
    ? workflows.find(workflow => workflow.id === item.workflowId)
    : null;
  if (matchedWorkflow) {
    return matchedWorkflow;
  }

  return createFallbackWorkflowFromProcessNodes();
}

function createFallbackWorkflowFromProcessNodes() {
  const nodes = Array.isArray(taskState.nodes) ? taskState.nodes : [];
  if (nodes.length === 0) {
    return null;
  }

  return {
    version: 1,
    id: 'fallback-task-process',
    name: 'Task process',
    fileName: 'generated',
    blocks: nodes.map(node => ({
      id: node.id,
      kind: 'step',
      stepType: getWorkflowStepTypeForTaskNode(node.id),
      title: node.label,
      status: taskNodeStatusToWorkflowStatus(node.status)
    }))
  };
}

function getWorkflowStepTypeForTaskNode(nodeId) {
  const types = {
    document: 'collect_document',
    figma: 'collect_figma',
    jira: 'collect_jira',
    markdown: 'review_human',
    code: 'custom',
    testcase: 'unit_test'
  };

  return types[nodeId] || 'custom';
}

function taskNodeStatusToWorkflowStatus(status) {
  if (status === 'Ready' || status === 'Sync') {
    return 'success';
  }

  if (status === 'Missing' || status === 'Un-sync') {
    return 'idle';
  }

  return 'idle';
}

function getWorkflowDetailCanvasShell(title, fileName, bodyHtml) {
  const runStatus = getWorkflowRunStatus();
  return \`
    <div class="workflow-detail-canvas run-\${runStatus}">
      <div class="workflow-detail-titlebar">
        <div class="workflow-detail-heading" title="\${escapeHtml(title)}">\${escapeHtml(title)}</div>
        <div class="workflow-detail-file" title="\${escapeHtml(fileName)}">\${escapeHtml(fileName)}</div>
      </div>
      <div class="workflow-detail-body">
        <div class="workflow-detail-zoom-surface" id="taskTreeZoomSurface">
          \${bodyHtml}
        </div>
      </div>
    </div>
    \${getWorkflowActionBarHtml(runStatus)}
  \`;
}

function getWorkflowDetailBlockHtml(block, locator) {
  if (block.kind === 'parallel') {
    return getWorkflowDetailParallelHtml(block, locator);
  }

  return getWorkflowDetailStepHtml(block, locator);
}

function getWorkflowDetailParallelHtml(block, locator) {
  const children = Array.isArray(block.children) ? block.children : [];
  const selectedClass = selectedWorkflowStepKey === workflowLocatorKey(locator) ? ' selected' : '';
  const status = getWorkflowBlockDisplayStatus(block);
  const title = getWorkflowDetailTaskTitle(block.title || 'Parallel');
  const completedIcon = getWorkflowCompletedIconHtml(status);
  const childrenHtml = children.length > 0
    ? children.map((child, childIndex) => getWorkflowDetailStepHtml(child, {
      type: 'parallel-child',
      parentIndex: locator.index,
      childIndex
    })).join('')
    : '<div class="workflow-detail-empty compact">No branches</div>';

  return \`
    <div class="workflow-detail-block-wrap parallel-wrap\${selectedClass}" data-workflow-group-locator='\${workflowLocatorAttr(locator)}'>
      <div class="workflow-detail-parallel status-\${statusClass(status)}">
        \${completedIcon}
        <div class="workflow-detail-parallel-header">
          <span>Parallel</span>
          <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
        </div>
        <div class="workflow-detail-parallel-children">\${childrenHtml}</div>
      </div>
      <div class="workflow-detail-label" title="\${escapeHtml(title)}">\${escapeHtml(title)}</div>
      <div class="workflow-detail-sublabel">parallel - \${children.length} branch\${children.length === 1 ? '' : 'es'}</div>
    </div>
  \`;
}

function getWorkflowDetailStepHtml(step, locator) {
  const locatorKey = workflowLocatorKey(locator);
  const selectedClass = selectedWorkflowStepKey === locatorKey ? ' selected' : '';
  const detailNodeId = getDetailNodeIdForWorkflowStep(step);
  const processNode = getProcessNodeByDetailId(detailNodeId);
  const status = getWorkflowStepDisplayStatus(step, processNode);
  const stepType = formatStepType(step.stepType);
  const title = getWorkflowDetailTaskTitle(step.title || getWorkflowStepTitle(step.stepType));
  const runningDisabled = getWorkflowRunStatus() === 'running';
  const completedIcon = getWorkflowCompletedIconHtml(status);
  const runningBorder = getWorkflowRunningBorderHtml();
  const errorTooltip = getWorkflowErrorTooltipHtml(step);

  return \`
    <button class="workflow-detail-block-wrap step-wrap\${selectedClass}" type="button" data-workflow-step-locator='\${workflowLocatorAttr(locator)}' aria-label="\${escapeHtml(title + ', status ' + status)}"\${runningDisabled ? ' disabled' : ''}>
      <span class="workflow-detail-card status-\${statusClass(status)}">
        \${runningBorder}
        \${completedIcon}
        <span class="workflow-detail-icon">\${getWorkflowStepIconHtml(step)}</span>
        <span class="workflow-detail-status status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
      </span>
      <span class="workflow-detail-label" title="\${escapeHtml(title)}">\${escapeHtml(title)}</span>
      <span class="workflow-detail-sublabel">\${escapeHtml(stepType)}</span>
      \${errorTooltip}
    </button>
  \`;
}

function bindWorkflowDetailTree() {
  bindWorkflowErrorTooltipActions();

  if (getWorkflowRunStatus() === 'running') {
    return;
  }

  document.querySelectorAll('[data-workflow-step-locator]').forEach(button => {
    button.onclick = () => {
      const locator = JSON.parse(button.dataset.workflowStepLocator);
      const step = getWorkflowBlockByLocator(locator);
      if (!step) {
        return;
      }

      openWorkflowStepDetail(step, locator);
    };
  });

  document.querySelectorAll('[data-workflow-group-locator]').forEach(group => {
    group.onclick = event => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (target?.closest('[data-workflow-step-locator]')) {
        return;
      }

      const locator = JSON.parse(group.dataset.workflowGroupLocator);
      const block = getWorkflowBlockByLocator(locator);
      if (!block) {
        return;
      }

      openWorkflowStepDetail(block, locator);
    };
  });
}

function bindWorkflowErrorTooltipActions() {
  document.querySelectorAll('[data-workflow-error-close]').forEach(close => {
    close.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      closeWorkflowErrorTooltip(close.dataset.workflowErrorClose);
    };
  });
}

function bindWorkflowDetailActions() {
  const runButton = document.getElementById('taskWorkflowRunButton');
  if (!runButton) {
    return;
  }

  runButton.onclick = () => {
    const runStatus = getWorkflowRunStatus();
    if (runStatus === 'idle') {
      startWorkflowRunFromAction();
      return;
    }

    if (runStatus === 'running') {
      workflowRunState.message = 'Workflow run is already in progress.';
      renderTree();
    }
  };
}

function getWorkflowActionBarHtml(runStatus) {
  const labels = {
    idle: 'RUN',
    running: 'RUNNING',
    finished: 'COMPLETED'
  };
  const message = workflowRunState.message
    ? '<span class="workflow-run-message">' + escapeHtml(workflowRunState.message) + '</span>'
    : '';

  return \`
    <div class="workflow-detail-actionbar">
      <div class="workflow-detail-actions">
        \${message}
        <button id="taskWorkflowRunButton" class="workflow-run-button \${runStatus}" type="button"\${runStatus === 'running' ? ' disabled' : ''}>\${labels[runStatus] || labels.idle}</button>
      </div>
    </div>
  \`;
}

function startWorkflowRunFromAction() {
  const workflow = getActiveTaskWorkflow();
  const blocks = workflow && Array.isArray(workflow.blocks) ? workflow.blocks : [];
  if (!workflow || blocks.length === 0) {
    failTaskWorkflowRun('Add at least one workflow step before running this item.');
    return;
  }

  taskState.currentWorkflow = workflow;
  workflowRunState.status = 'running';
  workflowRunState.pendingRun = false;
  workflowRunState.message = 'Running workflow...';
  workflowRunState.errorTooltips = {};
  markdownDialogState.isOpen = false;
  markdownDialogState.isLoading = false;
  markdownDialogState.isRunning = false;
  markdownDialogState.isError = false;
  codeRunState.isRunning = false;
  codeRunState.isError = false;
  codeRunState.message = '';
  codeRunState.markdownPath = '';
  selectedWorkflowStepKey = '';
  selectedWorkflowStep = null;
  detailModalState.isOpen = false;
  renderMarkdownDialog();
  refreshDetailView();

  vscode.postMessage({
    command: 'runTaskWorkflow',
    data: getWorkflowRunRequestContext()
  });
}

function getWorkflowRunRequestContext() {
  if (typeof captureJiraFields === 'function') {
    captureJiraFields();
  }

  const jiraLink = String(jiraFormState.link || taskState.jira?.link || '').trim();
  return getTaskRequestContext({ jiraLink });
}

function runWorkflowMarkdownContent(content) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    failWorkflowRun('No markdown brief to run.');
    return;
  }

  workflowRunState.status = 'running';
  workflowRunState.pendingRun = false;
  workflowRunState.message = 'Opening Claude Code terminal...';
  markdownDialogState.isOpen = false;
  markdownDialogState.isLoading = false;
  markdownDialogState.isRunning = true;
  markdownDialogState.isError = false;
  codeRunState.isRunning = true;
  codeRunState.isError = false;
  codeRunState.message = 'Opening Claude Code terminal...';
  codeRunState.markdownPath = '';
  selectedWorkflowStepKey = '';
  selectedWorkflowStep = null;
  selectedNodeId = 'code';
  detailModalState.isOpen = false;
  renderMarkdownDialog();
  refreshDetailView();

  vscode.postMessage({
    command: 'runTaskMarkdown',
    data: getTaskRequestContext({
      content: cleanContent
    })
  });
}

function failWorkflowRun(message) {
  workflowRunState.status = 'idle';
  workflowRunState.pendingRun = false;
  workflowRunState.message = message || 'Run failed.';
  markdownDialogState.isLoading = false;
  markdownDialogState.isRunning = false;
  markdownDialogState.isError = true;
  markdownDialogState.message = workflowRunState.message;
  codeRunState.isRunning = false;
  codeRunState.isError = true;
  codeRunState.message = workflowRunState.message;
  selectedWorkflowStepKey = '';
  selectedWorkflowStep = null;
  selectedNodeId = 'code';
  detailModalState.isOpen = true;
  refreshDetailView();
}

function failTaskWorkflowRun(message, blockId) {
  workflowRunState.status = 'idle';
  workflowRunState.pendingRun = false;
  workflowRunState.message = message || 'Workflow failed.';
  markdownDialogState.isLoading = false;
  markdownDialogState.isRunning = false;
  markdownDialogState.isError = true;
  markdownDialogState.message = workflowRunState.message;
  codeRunState.isRunning = false;
  codeRunState.isError = true;
  codeRunState.message = workflowRunState.message;
  detailModalState.isOpen = false;
  const tooltipHandled = showWorkflowErrorTooltipForBlock(blockId, workflowRunState.message);
  refreshDetailView();
  if (!tooltipHandled) {
    showWorkflowErrorPopup(workflowRunState.message);
  }
}

function showWorkflowErrorTooltipForBlock(blockId, message) {
  const block = findWorkflowBlockById(getActiveTaskWorkflow(), blockId);
  if (!block || block.kind !== 'step' || !['collect_jira', 'review_human'].includes(block.stepType)) {
    return false;
  }

  workflowRunState.errorTooltips = Object.assign({}, workflowRunState.errorTooltips || {}, {
    [blockId]: getWorkflowErrorTooltipMessage(message)
  });
  return true;
}

function closeWorkflowErrorTooltip(blockId) {
  if (!blockId || !workflowRunState.errorTooltips) {
    return;
  }

  const nextTooltips = Object.assign({}, workflowRunState.errorTooltips);
  delete nextTooltips[blockId];
  workflowRunState.errorTooltips = nextTooltips;
  renderTree();
}

function showWorkflowErrorPopup(message) {
  const text = String(message || 'Workflow failed.').trim();
  if (!text) {
    return;
  }

  setTimeout(() => {
    window.alert(text);
  }, 0);
}

function openWorkflowStepDetail(block, locator) {
  selectedWorkflowStepKey = workflowLocatorKey(locator);
  selectedWorkflowStep = block;
  selectedNodeId = block.kind === 'parallel'
    ? 'custom'
    : getDetailNodeIdForWorkflowStep(block);
  detailModalState.isOpen = true;
  renderTree();
  renderTaskDetailModal();
}

function closeTaskDetailModal() {
  detailModalState.isOpen = false;
  renderTaskDetailModal();
}

function renderTaskDetailModal() {
  const existingDialog = document.getElementById('taskDetailModal');
  if (!detailModalState.isOpen) {
    if (existingDialog) {
      existingDialog.remove();
    }
    return;
  }

  const activeNode = getActiveDetailNode();
  const title = activeNode.label || 'Workflow step';
  const subtitle = selectedWorkflowStep
    ? selectedWorkflowStep.kind === 'parallel'
      ? 'Parallel workflow group'
      : formatStepType(selectedWorkflowStep.stepType)
    : 'Task detail';
  const dialogHtml = \`
    <div class="task-detail-modal-backdrop" id="taskDetailModal">
      <div class="task-detail-modal" role="dialog" aria-modal="true" aria-label="\${escapeHtml(title)}">
        <div class="task-detail-modal-header">
          <div>
            <h2>\${escapeHtml(title)}</h2>
            <p class="detail-copy">\${escapeHtml(subtitle)}</p>
          </div>
          <button class="task-detail-modal-close" id="closeTaskDetailModalBtn" type="button" aria-label="Close detail">x</button>
        </div>
        <div class="task-detail-modal-body" id="taskDetail"></div>
      </div>
    </div>
  \`;

  if (existingDialog) {
    existingDialog.outerHTML = dialogHtml;
  } else {
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
  }

  bindTaskDetailModal();
  renderDetail();
}

function bindTaskDetailModal() {
  const closeButton = document.getElementById('closeTaskDetailModalBtn');
  const backdrop = document.getElementById('taskDetailModal');

  if (closeButton) {
    closeButton.onclick = closeTaskDetailModal;
  }

  if (backdrop) {
    backdrop.onclick = event => {
      if (event.target === backdrop) {
        closeTaskDetailModal();
      }
    };
  }
}

function renderDetail() {
  const detail = document.getElementById('taskDetail');
  if (!detail) {
    return;
  }

  const activeNode = getActiveDetailNode();

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

  renderGenericWorkflowStepDetail(detail, activeNode);
}

function renderGenericWorkflowStepDetail(detail, activeNode) {
  const status = activeNode?.status || 'Unknown';
  const config = selectedWorkflowStep && selectedWorkflowStep.config
    ? getWorkflowConfigPreview(selectedWorkflowStep.config)
    : '';

  detail.innerHTML = \`
    <div class="detail-header">
      <h2>\${escapeHtml(activeNode?.label || selectedNodeId)}</h2>
      <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
      <p class="detail-copy">\${escapeHtml(getGenericStepCopy(selectedWorkflowStep))}</p>
    </div>
    \${config}
  \`;
}

function getGenericStepCopy(step) {
  if (!step) {
    return 'Current status: Unknown';
  }

  if (step.kind === 'parallel') {
    const children = Array.isArray(step.children) ? step.children.length : 0;
    return 'Parallel group with ' + children + ' branch' + (children === 1 ? '' : 'es') + '.';
  }

  return 'Workflow step type: ' + formatStepType(step.stepType) + '.';
}

function getWorkflowConfigPreview(config) {
  const entries = Object.keys(config || {});
  if (entries.length === 0) {
    return '';
  }

  return \`
    <div class="workflow-step-config">
      <div class="jira-ticket-field-title">Config</div>
      <pre class="jira-ticket-content">\${escapeHtml(JSON.stringify(config, null, 2))}</pre>
    </div>
  \`;
}

function renderMarkdownDetail(detail, activeNode) {
  const status = activeNode?.status || 'Missing';
  const isReviewHumanStep = selectedWorkflowStep?.kind === 'step' && selectedWorkflowStep.stepType === 'review_human';
  const actionHtml = isReviewHumanStep
    ? \`
      <div class="detail-action-row">
        <button id="markReviewHumanDoneBtn" type="button">Mark it done</button>
        <button class="secondary" id="openMarkdownDialogBtn" type="button">Open markdown</button>
      </div>
    \`
    : '<button id="openMarkdownDialogBtn" type="button">Open markdown</button>';

  detail.innerHTML = \`
    <div class="detail-header">
      <h2>\${escapeHtml(activeNode?.label || 'Markdown')}</h2>
      <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
      <p class="detail-copy">Condensed implementation brief from imported documents, selected Figma nodes, and Jira content.</p>
    </div>
    \${actionHtml}
  \`;

  const openButton = document.getElementById('openMarkdownDialogBtn');
  if (openButton) {
    openButton.onclick = openMarkdownDialog;
  }

  const markDoneButton = document.getElementById('markReviewHumanDoneBtn');
  if (markDoneButton) {
    markDoneButton.onclick = markSelectedWorkflowStepDone;
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
      <h2>\${escapeHtml(activeNode?.label || 'Code')}</h2>
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

function markSelectedWorkflowStepDone() {
  if (!selectedWorkflowStep || selectedWorkflowStep.kind !== 'step') {
    return;
  }

  selectedWorkflowStep.status = 'success';
  updateSelectedWorkflowParentStatus();
  closeWorkflowErrorTooltip(selectedWorkflowStep.id);
  workflowRunState.message = 'Marked "' + (selectedWorkflowStep.title || getWorkflowStepTitle(selectedWorkflowStep.stepType)) + '" completed.';
  markdownDialogState.isOpen = false;
  markdownDialogState.isLoading = false;
  markdownDialogState.isRunning = false;
  markdownDialogState.isError = false;
  markdownDialogState.message = workflowRunState.message;
  refreshDetailView();
  renderMarkdownDialog();

  vscode.postMessage({
    command: 'markWorkflowStepDone',
    data: getTaskRequestContext({
      stepId: selectedWorkflowStep.id,
      locator: getSelectedWorkflowLocator()
    })
  });
}

function getWorkflowErrorTooltipHtml(step) {
  const message = step?.id ? workflowRunState.errorTooltips?.[step.id] : '';
  if (!message) {
    return '';
  }

  return \`
    <span class="workflow-error-tooltip" role="status">
      <span class="workflow-error-tooltip-text">\${escapeHtml(getWorkflowErrorTooltipMessage(message))}</span>
      <span class="workflow-error-tooltip-close" role="button" tabindex="0" aria-label="Close error" data-workflow-error-close="\${escapeHtml(step.id)}">x</span>
    </span>
  \`;
}

function getWorkflowErrorTooltipMessage(message) {
  return String(message || 'Workflow failed.')
    .replace(/^WorkflowRunError:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function updateSelectedWorkflowParentStatus() {
  const locator = getSelectedWorkflowLocator();
  if (!locator || locator.type !== 'parallel-child') {
    return;
  }

  const parent = getWorkflowBlockByLocator({
    type: 'root',
    index: locator.parentIndex
  });
  if (!parent || parent.kind !== 'parallel') {
    return;
  }

  parent.status = parent.children.every(child => child.status === 'success' || child.status === 'skipped')
    ? 'success'
    : 'idle';
}

function getSelectedWorkflowLocator() {
  if (!selectedWorkflowStepKey) {
    return null;
  }

  try {
    return JSON.parse(selectedWorkflowStepKey);
  } catch {
    return null;
  }
}

function setWorkflowFromRunMessage(workflow) {
  if (!workflow || !Array.isArray(workflow.blocks)) {
    return;
  }

  taskState.currentWorkflow = workflow;
}

function updateWorkflowBlockStatus(blockId, status) {
  const workflow = getActiveTaskWorkflow();
  if (!workflow || !blockId) {
    return;
  }

  const block = findWorkflowBlockById(workflow, blockId);
  if (block) {
    block.status = status;
  }
}

function findWorkflowBlockById(workflow, blockId) {
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];

  for (const block of blocks) {
    if (block.id === blockId) {
      return block;
    }

    if (block.kind === 'parallel') {
      const child = block.children.find(candidate => candidate.id === blockId);
      if (child) {
        return child;
      }
    }
  }

  return null;
}

function getWorkflowBlockByLocator(locator) {
  const workflow = getActiveTaskWorkflow();
  const blocks = workflow && Array.isArray(workflow.blocks) ? workflow.blocks : [];

  if (!locator) {
    return null;
  }

  if (locator.type === 'root') {
    return blocks[Number(locator.index)] || null;
  }

  if (locator.type === 'parallel-child') {
    const parent = blocks[Number(locator.parentIndex)];
    return parent && parent.kind === 'parallel'
      ? parent.children[Number(locator.childIndex)] || null
      : null;
  }

  return null;
}

function workflowLocatorKey(locator) {
  return JSON.stringify(locator || {});
}

function workflowLocatorAttr(locator) {
  return escapeHtml(workflowLocatorKey(locator));
}

function getDetailNodeIdForWorkflowStep(step) {
  if (!step || step.kind === 'parallel') {
    return 'custom';
  }

  const mapping = {
    collect_document: 'document',
    collect_figma: 'figma',
    collect_jira: 'jira',
    review_human: 'markdown',
    unit_test: 'testcase',
    automation_test: 'testcase',
    auto_commit: 'code',
    custom: 'code'
  };

  return mapping[step.stepType] || 'custom';
}

function getProcessNodeByDetailId(nodeId) {
  const nodes = Array.isArray(taskState.nodes) ? taskState.nodes : [];
  return nodes.find(node => node.id === nodeId) || null;
}

function getActiveDetailNode() {
  const processNode = getProcessNodeByDetailId(selectedNodeId);
  if (selectedWorkflowStep) {
    const stepTitle = selectedWorkflowStep.title || processNode?.label || getWorkflowStepTitle(selectedWorkflowStep.stepType);
    return {
      id: selectedNodeId,
      label: getWorkflowDetailTaskTitle(stepTitle),
      status: selectedWorkflowStep.kind === 'parallel'
        ? getWorkflowBlockDisplayStatus(selectedWorkflowStep)
        : getWorkflowStepDisplayStatus(selectedWorkflowStep, processNode)
    };
  }

  return processNode || { id: selectedNodeId, label: selectedNodeId, status: 'Unknown' };
}

function getWorkflowDetailTaskTitle(stepTitle) {
  const cleanStepTitle = String(stepTitle || '').trim();
  const workflow = getActiveTaskWorkflow();
  const workflowTitle = String(workflow?.name || currentItem?.summary?.workflowName || '').trim();

  if (!workflowTitle || !cleanStepTitle) {
    return cleanStepTitle || workflowTitle || 'Workflow step';
  }

  if (cleanStepTitle === workflowTitle || cleanStepTitle.startsWith(workflowTitle + ' (')) {
    return cleanStepTitle;
  }

  return workflowTitle + ' (' + cleanStepTitle + ')';
}

function getWorkflowRunStatus() {
  if (codeRunState.isRunning || workflowRunState.status === 'running') {
    return 'running';
  }

  if (workflowRunState.status === 'finished') {
    return 'finished';
  }

  return 'idle';
}

function getWorkflowCompletedIconHtml(status) {
  if (statusClass(status) !== 'completed') {
    return '';
  }

  return '<span class="workflow-detail-completed-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.5 12.4 10.5 15.4 16.8 8.6"></path></svg></span>';
}

function getWorkflowRunningBorderHtml() {
  return '<span class="workflow-detail-running-border" aria-hidden="true"><svg viewBox="0 0 112 112" focusable="false"><rect x="2" y="2" width="108" height="108" rx="6" ry="6" pathLength="100"></rect></svg></span>';
}

function getWorkflowBlockDisplayStatus(block) {
  if (!block) {
    return 'Unknown';
  }

  if (block.status === 'running') {
    return 'Running';
  }

  if (block.status === 'failed') {
    return 'Failed';
  }

  if (block.status === 'success') {
    return 'Completed';
  }

  if (block.status === 'skipped') {
    return 'Skipped';
  }

  return 'Unknown';
}

function getWorkflowStepDisplayStatus(step, processNode) {
  if (step?.status === 'running') {
    return 'Running';
  }

  if (step?.status === 'failed') {
    return 'Failed';
  }

  if (step?.status === 'skipped') {
    return 'Skipped';
  }

  if (step?.status === 'success') {
    return 'Completed';
  }

  if (step?.stepType === 'custom' && codeRunState.isRunning) {
    return 'Running';
  }

  return processNode?.status || 'Unknown';
}

function getWorkflowStepTitle(stepType) {
  const labels = {
    collect_document: 'Document',
    collect_figma: 'Figma',
    collect_jira: 'Jira',
    review_human: 'Human review',
    unit_test: 'Unit test',
    automation_test: 'Automation test',
    auto_commit: 'Auto commit',
    custom: 'Custom step'
  };

  return labels[stepType] || 'Workflow step';
}

function formatStepType(stepType) {
  return String(stepType || 'custom').replace(/_/g, ' ');
}

function getWorkflowStepIconHtml(step) {
  const detailNodeId = getDetailNodeIdForWorkflowStep(step);
  if (detailNodeId !== 'custom') {
    return getNodeIcon(detailNodeId);
  }

  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="m6 6 12 12"></path><path d="m18 6-12 12"></path></svg>';
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

function bindTaskTreeZoomControls() {
  const zoomIn = document.getElementById('taskTreeZoomIn');
  const zoomOut = document.getElementById('taskTreeZoomOut');
  const zoomReset = document.getElementById('taskTreeZoomReset');

  if (zoomIn) {
    zoomIn.onclick = () => setTaskTreeZoom(taskTreeZoom + 0.1);
  }

  if (zoomOut) {
    zoomOut.onclick = () => setTaskTreeZoom(taskTreeZoom - 0.1);
  }

  if (zoomReset) {
    zoomReset.onclick = () => setTaskTreeZoom(1);
  }
}

function setTaskTreeZoom(nextZoom) {
  taskTreeZoom = Math.max(0.4, Math.min(2, Math.round(Number(nextZoom) * 10) / 10));
  applyTaskTreeZoom();
}

function applyTaskTreeZoom() {
  const surface = document.getElementById('taskTreeZoomSurface');
  if (surface) {
    surface.style.zoom = String(taskTreeZoom);
  }

  const label = document.getElementById('taskTreeZoomLevel');
  if (label) {
    label.textContent = Math.round(taskTreeZoom * 100) + '%';
  }
}
  `;
}
