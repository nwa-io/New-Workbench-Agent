export const taskLayout = `<div class="task-container">
  <header class="task-header">
    <div>
      <h1>Task Manager</h1>
      <p class="task-subtitle" id="taskModeSummary">Prepare context for a new task.</p>
    </div>
    <div class="mode-switch" role="tablist" aria-label="Task context">
      <button class="mode-button" id="taskModeTask" type="button">Task</button>
      <button class="mode-button" id="taskModeFixBug" type="button">Fix bug</button>
    </div>
  </header>

  <main class="task-manager-grid">
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

  <div class="task-footer">
    <button class="secondary" id="taskCloseBtn" type="button">Close</button>
  </div>
</div>
`;
