import { workflowStyles } from './styles';
import { workflowScript } from './script';

export function getWorkflowSettingsHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NWA Settings</title>
  <style>${workflowStyles}</style>
</head>
<body>
  <div class="app">
    <div class="tabs">
      <div class="tab active" data-tab="core">Core</div>
      <div class="tab" data-tab="workflows">Workflows</div>
    </div>

    <div id="panel-core" class="tab-panel active">
      <div class="core-empty">Core settings — coming later.</div>
    </div>

    <div id="panel-workflows" class="tab-panel">
      <div class="workflows-layout">
        <div class="sidebar">
          <div class="sidebar-header">
            <span>Workflows</span>
            <button id="new-workflow" class="icon-btn" title="New workflow">+</button>
          </div>
          <div id="workflow-list" class="workflow-list"></div>
        </div>
        <div class="canvas">
          <div class="canvas-header">
            <input id="canvas-title" class="canvas-title" type="text" placeholder="Workflow name" />
            <div id="canvas-actions" class="canvas-actions" style="visibility:hidden">
              <button id="add-parallel" class="btn secondary">Parallel group</button>
              <button id="validate-workflow" class="btn">Validate</button>
              <button id="export-workflow" class="btn secondary">Export</button>
            </div>
          </div>
          <div class="zoom-controls">
            <button id="zoom-out" title="Zoom out">−</button>
            <span id="zoom-level" class="zoom-level">100%</span>
            <button id="zoom-in" title="Zoom in">+</button>
            <button id="zoom-reset" title="Reset zoom">⊙</button>
          </div>
          <div id="canvas-body" class="canvas-body"></div>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">${workflowScript}</script>
</body>
</html>`;
}

export function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
