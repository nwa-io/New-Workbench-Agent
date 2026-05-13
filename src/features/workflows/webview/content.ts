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
      <div class="core-settings-layout">
        <nav class="settings-summary" aria-label="Core settings summary">
          <div class="summary-kicker">NWA Settings</div>
          <h1>Core settings</h1>
          <p>Manage shared integrations and workspace save paths used by NWA task workflows.</p>
          <a class="summary-link active" href="#core-integration" data-core-nav="core-integration">
            <span>Integration</span>
            <small>Figma token, Claude CLI, Codex CLI</small>
          </a>
          <a class="summary-link" href="#core-save-path" data-core-nav="core-save-path">
            <span>Save Path</span>
            <small>Default workspace paths</small>
          </a>
        </nav>

        <main class="settings-main" aria-label="Core settings">
          <section id="core-integration" class="settings-section">
            <div class="section-heading">
              <p class="section-kicker">Integration</p>
              <h2>Figma access token</h2>
              <p>Save a personal access token for Figma sync features. The token is stored in VS Code secret storage and is never rendered back into the page.</p>
            </div>
            <div class="settings-field">
              <label for="figma-access-token">Token</label>
              <div class="secret-input-row">
                <input id="figma-access-token" type="password" autocomplete="off" placeholder="Paste Figma access token" />
                <button id="save-figma-token" class="btn" type="button">Save</button>
                <button id="clear-figma-token" class="btn secondary" type="button">Clear</button>
              </div>
              <p id="figma-token-status" class="field-status">Loading token status...</p>
            </div>
            <div class="cli-settings">
              <div class="cli-settings-header">
                <div>
                  <h3>CLI authentication</h3>
                  <p>Check whether local coding CLIs are installed and signed in.</p>
                </div>
                <button id="refresh-cli-status" class="btn secondary" type="button">Refresh</button>
              </div>
              <div id="cli-status-list" class="cli-status-list"></div>
              <p id="cli-status-status" class="field-status"></p>
            </div>
          </section>

          <section id="core-save-path" class="settings-section">
            <div class="section-heading">
              <p class="section-kicker">Save Path</p>
              <h2>Default save paths</h2>
              <p>Review the workspace-relative paths NWA uses when it creates task data, workflow YAML, Figma cache files, and generated markdown.</p>
            </div>
            <div id="save-path-list" class="save-path-list"></div>
            <p id="save-path-status" class="field-status"></p>
          </section>
        </main>
      </div>
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
              <button id="import-workflow" class="btn secondary">Import</button>
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
