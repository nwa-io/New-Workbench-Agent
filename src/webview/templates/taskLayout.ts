export const taskLayout = `<div class="task-container">
  <header class="task-header">
    <div>
      <h1>Task Manager</h1>
      <p class="task-subtitle" id="taskModeSummary">Prepare context for a new task.</p>
    </div>
    <div class="task-header-actions">
      <button class="secondary" id="taskBackBtn" type="button" hidden>Back</button>
      <button id="taskCreateHeaderBtn" type="button">Create</button>
    </div>
  </header>

  <main class="task-list-view" id="taskListView">
    <section class="task-block">
      <div class="block-header">
        <div>
          <h2 id="taskListTitle">Tasks</h2>
          <p class="block-meta" id="taskListMeta">Loading...</p>
        </div>
      </div>
      <div class="task-item-list" id="taskItemList"></div>
    </section>
  </main>

  <main class="task-create-view" id="taskCreateView" hidden>
    <section class="task-block">
      <div class="create-form">
        <div class="create-stepper" aria-label="Create item steps">
          <button class="create-stepper-step" type="button" data-create-step="1">
            <span class="create-stepper-track" aria-hidden="true"></span>
            <span class="create-stepper-body">
              <span class="create-stepper-marker">1</span>
              <span class="create-stepper-copy">
                <span class="create-stepper-title">Select type</span>
                <span class="create-stepper-description">Task, bug, or analysis</span>
              </span>
            </span>
          </button>
          <button class="create-stepper-step" type="button" data-create-step="2">
            <span class="create-stepper-track" aria-hidden="true"></span>
            <span class="create-stepper-body">
              <span class="create-stepper-marker">2</span>
              <span class="create-stepper-copy">
                <span class="create-stepper-title">Enter name</span>
                <span class="create-stepper-description">Item folder name</span>
              </span>
            </span>
          </button>
          <button class="create-stepper-step" type="button" data-create-step="3">
            <span class="create-stepper-track" aria-hidden="true"></span>
            <span class="create-stepper-body">
              <span class="create-stepper-marker">3</span>
              <span class="create-stepper-copy">
                <span class="create-stepper-title">Workflow layout</span>
                <span class="create-stepper-description">Read-only YAML tree</span>
              </span>
            </span>
          </button>
        </div>

        <div class="create-step-panel" id="createStepTypePanel">
          <label class="form-field" for="createTypeSelect">
            <span>Type</span>
            <select id="createTypeSelect">
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="analysis">Analysis</option>
            </select>
          </label>
        </div>

        <div class="create-step-panel" id="createStepNamePanel" hidden>
          <label class="form-field" for="taskItemIdInput">
            <span>Name</span>
            <input id="taskItemIdInput" type="text" autocomplete="off" placeholder="IWSP-4456">
          </label>
        </div>

        <div class="create-step-panel" id="createStepWorkflowPanel" hidden>
          <label class="form-field" for="workflowLayoutSelect">
            <span>Workflow</span>
            <select id="workflowLayoutSelect"></select>
          </label>
          <div class="workflow-layout-preview" id="workflowLayoutPreview" aria-label="Workflow layout preview"></div>
        </div>

        <p class="create-status" id="taskCreateStatus"></p>
        <div class="create-actions">
          <button class="secondary" id="taskCreateCancelBtn" type="button">Cancel</button>
          <button class="secondary" id="taskCreatePrevBtn" type="button">Back</button>
          <button id="taskCreateNextBtn" type="button">Next</button>
          <button id="taskCreateSubmitBtn" type="button" hidden>Create</button>
        </div>
      </div>
    </section>
  </main>

  <main class="task-manager-grid" id="taskDetailView" hidden>
    <section class="task-block task-tree-block" aria-label="Task process tree">
      <div class="block-header">
        <div>
          <h2>Process</h2>
          <p id="taskDocumentsFolder" class="block-meta">Loading...</p>
        </div>
      </div>
      <div class="task-tree" id="taskTree"></div>
    </section>

    <section class="task-block task-detail-block" aria-label="Task node detail">
      <div id="taskDetail"></div>
    </section>
  </main>
</div>
`;
