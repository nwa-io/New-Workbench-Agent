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
        <label class="resource-item"><input type="checkbox" id="behaviour-md"><span class="resource-name">behaviour.md</span></label>
        <label class="resource-item"><input type="checkbox" id="skill-triggers-md"><span class="resource-name">skill-triggers.md</span></label>
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
</body>
</html>`;
}
