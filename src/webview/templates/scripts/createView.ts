export function getCreateViewScript(): string {
  return `
function openCreateView() {
  createFormState.step = 1;
  createFormState.type = modeToItemType(currentMode);
  createFormState.id = '';
  createFormState.workflowId = getDefaultWorkflowId();
  createFormState.message = '';
  createFormState.isError = false;
  createFormState.isCreating = false;
  showView('create');
}

function renderCreateView() {
  ensureCreateWorkflowSelection();

  document.getElementById('createStepTypePanel').hidden = createFormState.step !== 1;
  document.getElementById('createStepNamePanel').hidden = createFormState.step !== 2;
  document.getElementById('createStepWorkflowPanel').hidden = createFormState.step !== 3;

  updateCreateStepperState();

  const typeSelect = document.getElementById('createTypeSelect');
  if (typeSelect && typeSelect.value !== createFormState.type) {
    typeSelect.value = createFormState.type;
  }

  const idInput = document.getElementById('taskItemIdInput');
  if (idInput && idInput.value !== createFormState.id) {
    idInput.value = createFormState.id;
  }

  renderWorkflowLayoutSelect();
  renderWorkflowLayoutPreview();

  const status = document.getElementById('taskCreateStatus');
  status.textContent = createFormState.message || '';
  status.classList.toggle('error', createFormState.isError);
  document.getElementById('taskCreatePrevBtn').hidden = createFormState.step === 1;
  document.getElementById('taskCreateNextBtn').hidden = createFormState.step === 3;
  document.getElementById('taskCreateSubmitBtn').hidden = createFormState.step !== 3;
  document.getElementById('taskCreateNextBtn').disabled = createFormState.isCreating;
  document.getElementById('taskCreateSubmitBtn').disabled = createFormState.isCreating;

  bindCreateView();
}

function bindCreateView() {
  document.querySelectorAll('[data-create-step]').forEach(button => {
    button.onclick = () => {
      goToCreateStep(Number(button.dataset.createStep));
    };
  });

  const typeSelect = document.getElementById('createTypeSelect');
  if (typeSelect) {
    typeSelect.onchange = () => {
      createFormState.type = typeSelect.value;
      currentMode = itemTypeToMode(createFormState.type);
      createFormState.message = '';
      createFormState.isError = false;
      renderCreateView();
      updateModeControls();
    };
  }

  const idInput = document.getElementById('taskItemIdInput');
  if (idInput) {
    idInput.oninput = () => {
      createFormState.id = idInput.value;
      if (createFormState.isError) {
        createFormState.message = '';
        createFormState.isError = false;
        renderCreateView();
      } else {
        updateCreateStepperState();
      }
    };
    idInput.onkeydown = event => {
      if (event.key === 'Enter') {
        goToNextCreateStep();
      }
    };
  }

  const workflowSelect = document.getElementById('workflowLayoutSelect');
  if (workflowSelect) {
    workflowSelect.onchange = () => {
      createFormState.workflowId = workflowSelect.value;
      createFormState.message = '';
      createFormState.isError = false;
      renderCreateView();
    };
  }

  document.getElementById('taskCreateCancelBtn').onclick = () => showView('list');
  document.getElementById('taskCreatePrevBtn').onclick = () => goToCreateStep(createFormState.step - 1);
  document.getElementById('taskCreateNextBtn').onclick = goToNextCreateStep;
  document.getElementById('taskCreateSubmitBtn').onclick = submitCreateItem;
}

function captureCreateFields() {
  const typeSelect = document.getElementById('createTypeSelect');
  const idInput = document.getElementById('taskItemIdInput');
  const workflowSelect = document.getElementById('workflowLayoutSelect');

  if (typeSelect) {
    createFormState.type = typeSelect.value;
  }
  createFormState.id = normalizeCreateItemName(idInput ? idInput.value : createFormState.id);
  createFormState.workflowId = workflowSelect ? workflowSelect.value : createFormState.workflowId;
}

function goToCreateStep(step) {
  const targetStep = Math.max(1, Math.min(3, Number(step) || 1));
  captureCreateFields();

  if (targetStep > createFormState.step) {
    for (let currentStep = createFormState.step; currentStep < targetStep; currentStep++) {
      if (!validateCreateStep(currentStep)) {
        renderCreateView();
        focusCreateStepField(currentStep);
        return;
      }
    }
  }

  createFormState.step = targetStep;
  createFormState.message = '';
  createFormState.isError = false;
  renderCreateView();
}

function goToNextCreateStep() {
  goToCreateStep(createFormState.step + 1);
}

function validateCreateStep(step) {
  captureCreateFields();

  if (step === 1 && !isCreateTypeValid(createFormState.type)) {
    createFormState.message = 'Choose task, bug, or analysis.';
    createFormState.isError = true;
    return false;
  }

  if (step === 2 && !isCreateNameValid(createFormState.id)) {
    createFormState.message = 'Use letters, numbers, dots, underscores, or dashes only.';
    createFormState.isError = true;
    return false;
  }

  if (step === 3 && !isCreateWorkflowValid()) {
    createFormState.message = getWorkflowLayouts().length === 0
      ? 'Create a workflow in Workflow Settings first.'
      : 'Select a workflow.';
    createFormState.isError = true;
    return false;
  }

  createFormState.message = '';
  createFormState.isError = false;
  return true;
}

function updateCreateStepperState() {
  document.querySelectorAll('[data-create-step]').forEach(button => {
    const step = Number(button.dataset.createStep);
    const isSelected = step === createFormState.step;
    const isComplete = isCreateStepComplete(step);
    button.classList.toggle('on-select', isSelected);
    button.classList.toggle('fill', !isSelected && isComplete);
    button.classList.toggle('not-fill', !isSelected && !isComplete);
    button.classList.toggle('active', isSelected);
    button.classList.toggle('complete', !isSelected && isComplete);
    button.setAttribute('aria-current', isSelected ? 'step' : 'false');
  });

  document.querySelectorAll('[data-create-step-result]').forEach(result => {
    const step = Number(result.dataset.createStepResult);
    const text = getCreateStepResultText(step);
    result.textContent = text;
    result.hidden = !text;
  });
}

function isCreateStepComplete(step) {
  if (step === 1) {
    return isCreateTypeValid(createFormState.type);
  }

  if (step === 2) {
    return isCreateNameValid(createFormState.id);
  }

  if (step === 3) {
    return isCreateWorkflowValid();
  }

  return false;
}

function isCreateTypeValid(type) {
  return ['task', 'bug', 'analysis'].includes(type);
}

function isCreateNameValid(id) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(String(id || '').trim());
}

function normalizeCreateItemName(id) {
  return String(id || '').trim().toUpperCase();
}

function isCreateWorkflowValid() {
  return Boolean(selectedCreateWorkflow());
}

function getCreateStepResultText(step) {
  if (step === 1 && isCreateTypeValid(createFormState.type)) {
    return itemTypeLabel(createFormState.type);
  }

  if (step === 2 && isCreateNameValid(createFormState.id)) {
    return normalizeCreateItemName(createFormState.id);
  }

  if (step === 3 && selectedCreateWorkflow()) {
    return getWorkflowOptionLabel(selectedCreateWorkflow());
  }

  return '';
}

function focusCreateStepField(step) {
  const fieldId = step === 1
    ? 'createTypeSelect'
    : step === 2
      ? 'taskItemIdInput'
      : 'workflowLayoutSelect';
  const field = document.getElementById(fieldId);
  if (field) {
    setTimeout(() => field.focus(), 0);
  }
}

function submitCreateItem() {
  captureCreateFields();

  for (let step = 1; step <= 3; step++) {
    if (!validateCreateStep(step)) {
      createFormState.step = step;
      renderCreateView();
      focusCreateStepField(step);
      return;
    }
  }

  const itemName = normalizeCreateItemName(createFormState.id);
  createFormState.id = itemName;
  createFormState.isCreating = true;
  createFormState.isError = false;
  createFormState.message = 'Creating ' + itemTypeText(createFormState.type) + '...';
  renderCreateView();

  vscode.postMessage({
    command: 'createTaskItem',
    data: {
      id: itemName,
      name: itemName,
      type: createFormState.type,
      workflowId: createFormState.workflowId || undefined
    }
  });
}

function getWorkflowLayouts() {
  return Array.isArray(taskState.workflows) ? taskState.workflows : [];
}

function getDefaultWorkflowId() {
  const workflows = getWorkflowLayouts();
  return workflows.length > 0 ? workflows[0].id : '';
}

function ensureCreateWorkflowSelection() {
  const workflows = getWorkflowLayouts();
  if (workflows.length === 0) {
    createFormState.workflowId = '';
    return;
  }

  if (!workflows.find(workflow => workflow.id === createFormState.workflowId)) {
    createFormState.workflowId = workflows[0].id;
  }
}

function selectedCreateWorkflow() {
  const workflows = getWorkflowLayouts();
  return workflows.find(workflow => workflow.id === createFormState.workflowId) || null;
}

function renderWorkflowLayoutSelect() {
  const select = document.getElementById('workflowLayoutSelect');
  if (!select) {
    return;
  }

  const workflows = getWorkflowLayouts();
  select.innerHTML = workflows.length > 0
    ? workflows.map(workflow => '<option value="' + escapeHtml(workflow.id) + '">' + escapeHtml(getWorkflowOptionLabel(workflow)) + '</option>').join('')
    : '<option value="">No workflow YAML files found</option>';
  select.disabled = workflows.length === 0 || createFormState.isCreating;
  select.value = createFormState.workflowId;
}

function getWorkflowOptionLabel(workflow) {
  const fileName = workflow.fileName || '';
  const name = workflow.name || 'Untitled workflow';
  return fileName ? fileName + ' - ' + name : name;
}

const WORKFLOW_STEP_ICONS = {
  collect_document: '&#128196;',
  collect_figma: '&#127912;',
  collect_jira: '&#128203;',
  review_human: '&#128100;',
  unit_test: '&#129514;',
  automation_test: '&#129302;',
  auto_commit: '&#11014;',
  custom: '&#10022;'
};

function renderWorkflowLayoutPreview() {
  const preview = document.getElementById('workflowLayoutPreview');
  if (!preview) {
    return;
  }

  const workflows = getWorkflowLayouts();
  if (workflows.length === 0) {
    preview.innerHTML = '<div class="workflow-layout-empty">No workflow YAML files found in .project/workflows.</div>';
    return;
  }

  const workflow = selectedCreateWorkflow();
  if (!workflow) {
    preview.innerHTML = '<div class="workflow-layout-empty">Select a workflow.</div>';
    return;
  }

  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const fileName = workflow.fileName || 'workflow.yaml';
  if (blocks.length === 0) {
    preview.innerHTML = getReadonlyWorkflowShell(
      workflow,
      fileName,
      '<div class="tree-empty">This workflow has no steps.</div>'
    );
    return;
  }

  const treeHtml = '<div class="tree">' + blocks.map((block, index) => {
      const connector = index > 0 ? '<div class="workflow-layout-connector"></div>' : '';
      return connector + getReadonlyWorkflowBlockHtml(block);
    }).join('') + '</div>';

  preview.innerHTML = getReadonlyWorkflowShell(workflow, fileName, treeHtml);
}

function getReadonlyWorkflowShell(workflow, fileName, bodyHtml) {
  return '<div class="workflow-layout-canvas">' +
    '<div class="workflow-layout-header">' +
      '<div class="workflow-layout-title" title="' + escapeHtml(workflow.name || 'Untitled workflow') + '">' + escapeHtml(workflow.name || 'Untitled workflow') + '</div>' +
      '<div class="workflow-layout-file" title="' + escapeHtml(fileName) + '">' + escapeHtml(fileName) + '</div>' +
    '</div>' +
    '<div class="workflow-layout-body">' + bodyHtml + '</div>' +
  '</div>';
}

function getReadonlyWorkflowBlockHtml(block) {
  if (block.kind === 'parallel') {
    const children = Array.isArray(block.children) ? block.children : [];
    const childrenHtml = children.length > 0
      ? children.map(child => getReadonlyWorkflowStepHtml(child)).join('')
      : '<div class="tree-empty compact">No branches</div>';
    const status = block.status || 'idle';

    return '<div class="block-wrap workflow-layout-block-wrap" style="width: auto;">' +
      '<div class="parallel-group status-' + escapeHtml(status) + '">' +
        '<div class="parallel-header">Parallel</div>' +
        '<div class="parallel-children">' + childrenHtml + '</div>' +
      '</div>' +
      '<div class="block-label" title="' + escapeHtml(block.title || 'Parallel') + '">' + escapeHtml(block.title || 'Parallel') + '</div>' +
      '<div class="block-sublabel">parallel - ' + children.length + ' branch' + (children.length === 1 ? '' : 'es') + '</div>' +
    '</div>';
  }

  return getReadonlyWorkflowStepHtml(block);
}

function getReadonlyWorkflowStepHtml(step) {
  const status = step.status || 'idle';
  return '<div class="block-wrap workflow-layout-block-wrap">' +
    '<div class="block-card status-' + escapeHtml(status) + '">' +
      '<div class="block-icon">' + getWorkflowStepIcon(step.stepType) + '</div>' +
    '</div>' +
    '<div class="block-label" title="' + escapeHtml(step.title || 'Step') + '">' + escapeHtml(step.title || 'Step') + '</div>' +
    '<div class="block-sublabel">' + escapeHtml(formatStepType(step.stepType)) + '</div>' +
  '</div>';
}

function getWorkflowStepIcon(stepType) {
  return WORKFLOW_STEP_ICONS[stepType] || WORKFLOW_STEP_ICONS.custom;
}

function formatStepType(stepType) {
  return String(stepType || 'custom').replace(/_/g, ' ');
}
  `;
}
