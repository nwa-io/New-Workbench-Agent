export function getClaudeResourceContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Resource Manager</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }

    .container {
      max-width: 980px;
      margin: 0 auto;
    }

    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: var(--vscode-editor-foreground);
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 30px;
    }

    .step {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .step-number {
      width: 32px;
      height: 32px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      flex-shrink: 0;
    }

    .step-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .step-title {
      font-size: 18px;
      font-weight: 600;
    }

    .step-name {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    .resource-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin-top: 4px;
    }

    .resource-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 12px;
      transition: border-color 0.2s ease, background-color 0.2s ease;
    }

    .resource-item:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-button-secondaryBackground);
    }

    .resource-item input[type="checkbox"] {
      transform: scale(1.1);
      flex-shrink: 0;
    }

    .resource-name {
      font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      font-size: 13px;
      line-height: 1.25;
    }

    body.has-install-bar {
      padding-bottom: 116px;
    }

    .install-bar {
      position: fixed;
      left: 50%;
      bottom: 18px;
      width: min(860px, calc(100vw - 32px));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      padding: 14px 16px;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, 18px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      z-index: 1000;
    }

    .install-bar.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0);
    }

    .install-summary {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .install-title {
      font-size: 14px;
      font-weight: 600;
    }

    .install-detail {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .install-actions {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }

    .install-actions button {
      border: none;
      border-radius: 6px;
      padding: 9px 14px;
      cursor: pointer;
      font-size: 13px;
      font-family: var(--vscode-font-family);
    }

    #install-claude-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    #install-claude-btn:hover:enabled {
      background: var(--vscode-button-hoverBackground);
    }

    #cancel-install-claude-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    #cancel-install-claude-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    @media (max-width: 620px) {
      .install-bar {
        align-items: stretch;
        flex-direction: column;
      }

      .install-actions {
        justify-content: flex-end;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Claude Resource Manager</h1>
    <p class="subtitle">Initialize Claude Code context resources by selecting files from each layer.</p>

    <section class="step">
      <div class="step-header">
        <div class="step-number">1</div>
        <div class="step-meta">
          <div class="step-title">Layer 1</div>
          <div class="step-name">Auto-loaded Rules</div>
        </div>
      </div>
      <div class="resource-list">
        <label class="resource-item"><input type="checkbox" id="claude-md"><span class="resource-name">claude.md</span></label>
        <label class="resource-item"><input type="checkbox" id="behaviour-md"><span class="resource-name">behaviour.md</span></label>
        <label class="resource-item"><input type="checkbox" id="skill-triggers-md"><span class="resource-name">SKILL.md</span></label>
        <label class="resource-item"><input type="checkbox" id="memory-flush-md"><span class="resource-name">memory-flush.md</span></label>
      </div>
    </section>

    <section class="step">
      <div class="step-header">
        <div class="step-number">2</div>
        <div class="step-meta">
          <div class="step-title">Layer 2</div>
          <div class="step-name">On-demand Docs</div>
        </div>
      </div>
      <div class="resource-list">
        <label class="resource-item"><input type="checkbox" id="agents-md"><span class="resource-name">agents.md</span></label>
        <label class="resource-item"><input type="checkbox" id="context-safety-md"><span class="resource-name">context-safety.md</span></label>
        <label class="resource-item"><input type="checkbox" id="task-routing-md"><span class="resource-name">task-routing.md</span></label>
        <label class="resource-item"><input type="checkbox" id="behaviour-extended-md"><span class="resource-name">behaviour-extended.md</span></label>
        <label class="resource-item"><input type="checkbox" id="scaffolding-checkpoint-md"><span class="resource-name">scaffolding-checkpoint.md</span></label>
      </div>
    </section>

    <section class="step">
      <div class="step-header">
        <div class="step-number">3</div>
        <div class="step-meta">
          <div class="step-title">Layer 3</div>
          <div class="step-name">hot Data</div>
        </div>
      </div>
      <div class="resource-list">
        <label class="resource-item"><input type="checkbox" id="today-md"><span class="resource-name">today.md</span></label>
        <label class="resource-item"><input type="checkbox" id="projects-md"><span class="resource-name">projects.md</span></label>
        <label class="resource-item"><input type="checkbox" id="goals-md"><span class="resource-name">goals.md</span></label>
        <label class="resource-item"><input type="checkbox" id="active-task-md"><span class="resource-name">active-task.md</span></label>
      </div>
    </section>
  </div>

  <div id="install-claude-bar" class="install-bar" aria-live="polite">
    <div class="install-summary">
      <div class="install-title">Ready to install</div>
      <div id="install-selection-summary" class="install-detail">No resources selected</div>
    </div>
    <div class="install-actions">
      <button id="cancel-install-claude-btn" type="button">Clear</button>
      <button id="install-claude-btn" type="button" disabled>Install</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const resourceCheckboxes = Array.from(document.querySelectorAll('.resource-item input[type="checkbox"]'));
    const installBar = document.getElementById('install-claude-bar');
    const installSummary = document.getElementById('install-selection-summary');
    const installButton = document.getElementById('install-claude-btn');
    const cancelButton = document.getElementById('cancel-install-claude-btn');
    let isInstalling = false;

    function getSelectedResources() {
      return resourceCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => {
          const label = checkbox.closest('.resource-item');
          const resourceName = label ? label.querySelector('.resource-name') : undefined;
          const name = resourceName ? resourceName.textContent.trim() : checkbox.id;
          return { id: checkbox.id, name };
        });
    }

    function updateInstallBar() {
      const selectedResources = getSelectedResources();
      const selectedCount = selectedResources.length;
      const hasSelection = selectedCount > 0;
      const resourceLabel = selectedCount === 1 ? 'resource' : 'resources';

      installBar.classList.toggle('visible', hasSelection);
      document.body.classList.toggle('has-install-bar', hasSelection);
      installButton.disabled = !hasSelection || isInstalling;
      cancelButton.disabled = isInstalling;

      if (!hasSelection) {
        installSummary.textContent = 'No resources selected';
        installButton.textContent = 'Install';
        return;
      }

      const selectedNames = selectedResources.map((resource) => resource.name).join(', ');
      installSummary.textContent = selectedCount + ' ' + resourceLabel + ': ' + selectedNames;
      if (!isInstalling) {
        installButton.textContent = 'Install';
      }
    }

    function clearSelection() {
      resourceCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateInstallBar();
    }

    resourceCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', updateInstallBar);
    });

    cancelButton.addEventListener('click', () => {
      if (!isInstalling) {
        clearSelection();
      }
    });

    installButton.addEventListener('click', () => {
      const selectedResources = getSelectedResources();
      if (selectedResources.length === 0 || isInstalling) {
        return;
      }

      isInstalling = true;
      installButton.disabled = true;
      cancelButton.disabled = true;
      installButton.textContent = 'Installing...';
      vscode.postMessage({
        command: 'installClaudeResources',
        resources: selectedResources.map((resource) => resource.id)
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.command === 'installClaudeResourcesComplete') {
        isInstalling = false;
        clearSelection();
      }

      if (message.command === 'installClaudeResourcesFailed') {
        isInstalling = false;
        updateInstallBar();
      }
    });

    updateInstallBar();
  </script>
</body>
</html>`;
}
