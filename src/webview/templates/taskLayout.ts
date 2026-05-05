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
      <div class="block-header">
        <div>
          <h2>Create item</h2>
          <p class="block-meta">Choose the item type, enter its ID, then start the workflow.</p>
        </div>
      </div>

      <div class="create-grid">
        <div class="create-form">
          <div class="item-type-switch" role="radiogroup" aria-label="Item type">
            <button class="item-type-button" id="createTypeTask" type="button" data-create-type="task">Task</button>
            <button class="item-type-button" id="createTypeBug" type="button" data-create-type="bug">Bug</button>
          </div>
          <label class="form-field" for="taskItemIdInput">
            <span>Task or bug ID</span>
            <input id="taskItemIdInput" type="text" autocomplete="off" placeholder="IWSP-4456">
          </label>
          <p class="create-status" id="taskCreateStatus"></p>
          <div class="create-actions">
            <button class="secondary" id="taskCreateCancelBtn" type="button">Cancel</button>
            <button id="taskCreateSubmitBtn" type="button">Create</button>
          </div>
        </div>

        <div class="workflow-mock" role="img" aria-label="Sample workflow tree">
          <svg viewBox="0 0 520 320" aria-hidden="true" focusable="false">
            <path class="workflow-line" d="M112 80 H230"></path>
            <path class="workflow-line" d="M290 80 H408"></path>
            <path class="workflow-line dashed" d="M260 112 V168"></path>
            <path class="workflow-line" d="M260 224 C218 252 185 258 142 274"></path>
            <path class="workflow-line" d="M260 224 C302 252 335 258 378 274"></path>
            <rect class="workflow-node wide" x="38" y="48" width="120" height="64" rx="8"></rect>
            <rect class="workflow-node" x="214" y="48" width="92" height="64" rx="8"></rect>
            <rect class="workflow-node" x="362" y="48" width="92" height="64" rx="8"></rect>
            <rect class="workflow-node" x="204" y="168" width="112" height="56" rx="8"></rect>
            <circle class="workflow-node circle" cx="126" cy="274" r="34"></circle>
            <circle class="workflow-node circle" cx="394" cy="274" r="34"></circle>
            <text x="98" y="86">Document</text>
            <text x="260" y="86">Figma</text>
            <text x="408" y="86">Jira</text>
            <text x="260" y="202">Markdown</text>
            <text x="126" y="279">Code</text>
            <text x="394" y="279">Test</text>
          </svg>
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
