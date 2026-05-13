export const workflowStyles = `
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
.app { display: flex; flex-direction: column; height: 100vh; }

.tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
}
.tab {
  padding: 8px 16px; cursor: pointer; user-select: none;
  border-bottom: 2px solid transparent; color: var(--vscode-tab-inactiveForeground);
}
.tab.active {
  color: var(--vscode-tab-activeForeground);
  border-bottom-color: var(--vscode-focusBorder);
  background: var(--vscode-tab-activeBackground);
}
.tab:hover { background: var(--vscode-list-hoverBackground); }

.tab-panel { display: none; flex: 1; overflow: hidden; }
.tab-panel.active { display: flex; }

.core-settings-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.settings-summary {
  width: 280px;
  min-width: 240px;
  border-right: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  padding: 28px 20px;
  overflow-y: auto;
}

.summary-kicker,
.section-kicker {
  margin: 0;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.settings-summary h1 {
  margin: 8px 0 10px;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
}

.settings-summary p {
  margin: 0 0 24px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}

.summary-link {
  display: block;
  padding: 10px 0 10px 12px;
  border-left: 2px solid transparent;
  color: var(--vscode-foreground);
  text-decoration: none;
}

.summary-link:hover {
  background: var(--vscode-list-hoverBackground);
}

.summary-link.active {
  border-left-color: var(--vscode-focusBorder);
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.summary-link span {
  display: block;
  font-weight: 600;
}

.summary-link small {
  display: block;
  margin-top: 3px;
  color: var(--vscode-descriptionForeground);
}

.settings-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 0 36px;
  scroll-behavior: smooth;
}

.settings-section {
  max-width: 880px;
  padding: 42px 0 48px;
  border-bottom: 1px solid var(--vscode-panel-border);
  scroll-margin-top: 20px;
}

.settings-section:last-child {
  border-bottom: none;
}

.section-heading h2 {
  margin: 6px 0 8px;
  font-size: 22px;
  line-height: 1.25;
}

.section-heading p:not(.section-kicker) {
  max-width: 720px;
  margin: 0;
  color: var(--vscode-descriptionForeground);
  line-height: 1.55;
}

.settings-field {
  margin-top: 22px;
}

.settings-field label,
.save-path-title {
  display: block;
  margin-bottom: 7px;
  font-weight: 600;
}

.settings-field input,
.save-path-control input {
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
  border-radius: 3px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  font-size: 13px;
}

.settings-field input:focus,
.save-path-control input:focus {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}

.save-path-control input[readonly] {
  background: transparent;
  color: var(--vscode-descriptionForeground);
}

.secret-input-row,
.save-path-control {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.field-status {
  min-height: 18px;
  margin: 8px 0 0;
  color: var(--vscode-descriptionForeground);
  line-height: 1.4;
}

.field-status.error {
  color: var(--vscode-errorForeground);
}

.cli-settings {
  margin-top: 34px;
}

.cli-settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.cli-settings-header h3 {
  margin: 0 0 5px;
  font-size: 16px;
}

.cli-settings-header p {
  margin: 0;
  color: var(--vscode-descriptionForeground);
}

.cli-status-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px;
}

.cli-status-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 14px;
  background: var(--vscode-editorWidget-background);
}

.cli-status-card.success {
  border-color: rgba(76, 175, 80, 0.65);
}

.cli-status-card.warning {
  border-color: rgba(245, 158, 11, 0.7);
}

.cli-status-card.error {
  border-color: var(--vscode-errorForeground);
}

.cli-status-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.cli-status-title {
  margin: 0;
  font-weight: 700;
}

.cli-status-meta,
.cli-status-message {
  margin: 6px 0 0;
  color: var(--vscode-descriptionForeground);
  line-height: 1.4;
}

.cli-status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-pill.success {
  color: #1f7a31;
  background: rgba(76, 175, 80, 0.16);
}

.status-pill.warning {
  color: #b7791f;
  background: rgba(245, 158, 11, 0.16);
}

.status-pill.error {
  color: var(--vscode-errorForeground);
  background: rgba(244, 67, 54, 0.12);
}

.save-path-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 24px;
}

.save-path-row {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.save-path-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.save-path-description,
.save-path-meta {
  margin: 0 0 9px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.45;
}

.save-path-meta code {
  color: var(--vscode-textPreformat-foreground);
}

@media (max-width: 760px) {
  .core-settings-layout {
    flex-direction: column;
  }

  .settings-summary {
    width: 100%;
    min-width: 0;
    border-right: none;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 18px 20px;
  }

  .settings-main {
    padding: 0 20px;
  }

  .secret-input-row,
  .save-path-control,
  .cli-status-list {
    grid-template-columns: 1fr;
  }
}

.workflows-layout { display: flex; flex: 1; min-height: 0; }

.sidebar {
  width: 240px; min-width: 200px;
  border-right: 1px solid var(--vscode-panel-border);
  display: flex; flex-direction: column;
  background: var(--vscode-sideBar-background);
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border);
  font-weight: 600; text-transform: uppercase; font-size: 11px;
  color: var(--vscode-sideBarSectionHeader-foreground);
}
.icon-btn {
  background: transparent; border: none; cursor: pointer;
  color: var(--vscode-icon-foreground); padding: 2px 6px; font-size: 14px;
  border-radius: 3px;
}
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn.danger:hover { color: var(--vscode-errorForeground); }

.workflow-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.workflow-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; cursor: pointer; gap: 6px;
}
.workflow-item:hover { background: var(--vscode-list-hoverBackground); }
.workflow-item.active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}
.workflow-item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workflow-item .actions { display: none; gap: 2px; }
.workflow-item:hover .actions { display: flex; }
.workflow-list-empty {
  padding: 12px; color: var(--vscode-descriptionForeground); font-style: italic;
}

.canvas {
  flex: 1; overflow: hidden;
  background: var(--vscode-editor-background);
  background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 16px 16px;
  display: flex; flex-direction: column;
  position: relative;
}

.zoom-controls {
  position: absolute;
  top: 72px; left: 16px;
  display: flex; align-items: center;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 2px;
  gap: 2px;
  z-index: 10;
  font-size: 12px;
}
.zoom-controls button {
  background: transparent; border: none; cursor: pointer;
  color: var(--vscode-foreground);
  width: 24px; height: 22px;
  border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.zoom-controls button:hover { background: var(--vscode-toolbar-hoverBackground); }
.zoom-level {
  min-width: 40px; text-align: center;
  color: var(--vscode-descriptionForeground);
  user-select: none;
}
.canvas-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 16px 24px;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
}
.canvas-title {
  font-size: 16px; font-weight: 600;
  background: transparent; border: none; color: var(--vscode-foreground);
  flex: 1; padding: 4px 6px; border-radius: 3px;
  max-width: 320px;
}
.canvas-title:hover, .canvas-title:focus {
  background: var(--vscode-input-background);
  outline: 1px solid var(--vscode-focusBorder);
}
.canvas-actions { display: flex; gap: 6px; }
.btn {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; padding: 5px 12px; cursor: pointer; border-radius: 2px;
  font-size: 12px;
}
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.btn.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

.canvas-body {
  flex: 1; min-height: 0; overflow: auto;
  padding: 32px 24px;
  display: flex; justify-content: center;
}
.tree {
  display: flex; flex-direction: column; align-items: center;
  gap: 0; flex-wrap: nowrap;
  min-height: 200px;
}
.tree-empty {
  margin: auto;
  color: var(--vscode-descriptionForeground);
}

.block-wrap {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  width: 140px; flex-shrink: 0;
}

.insert-handle {
  position: absolute;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--vscode-editorWidget-background);
  border: 1px dashed rgba(255, 255, 255, 0.35);
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: none;
  align-items: center; justify-content: center;
  font-size: 14px;
  z-index: 3;
}
.insert-handle.top {
  top: -28px;
  left: 50%; transform: translateX(-50%);
}
.insert-handle.left {
  left: -22px;
  top: 50%; transform: translateY(-50%);
}
.block-wrap:hover > .insert-handle,
.block-wrap.selected > .insert-handle { display: flex; }
.insert-handle:hover {
  border-style: solid;
  border-color: var(--vscode-focusBorder);
  color: var(--vscode-focusBorder);
}

.block-card {
  position: relative;
  width: 110px; height: 110px;
  background: rgba(45, 45, 48, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px;
  transition: border-color 0.15s, transform 0.1s;
}
.block-card:hover {
  border-color: var(--vscode-focusBorder);
  transform: translateY(-1px);
}
.block-card.status-running { border-color: var(--vscode-progressBar-background); }
.block-card.status-success { border-color: #4caf50; }
.block-card.status-failed { border-color: var(--vscode-errorForeground); }
.block-wrap.selected .block-card,
.block-wrap.selected .parallel-group {
  border-color: var(--vscode-focusBorder);
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.block-label {
  margin-top: 14px;
  font-size: 13px;
  font-weight: 500;
  max-width: 140px;
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--vscode-foreground);
}
.block-sublabel {
  margin-top: 4px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  max-width: 140px;
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.block-delete {
  position: absolute; top: -6px; right: -6px;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  display: none; align-items: center; justify-content: center;
  cursor: pointer; font-size: 12px; color: var(--vscode-foreground);
  z-index: 2;
}
.block-card:hover .block-delete,
.parallel-group:hover > .block-delete { display: flex; }
.block-delete:hover {
  background: var(--vscode-errorForeground);
  color: var(--vscode-editor-background);
}

.connector {
  width: 0;
  height: 32px;
  border-left: 1px dashed rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.add-after-wrap {
  display: flex; flex-direction: column; align-items: center;
  width: 140px; flex-shrink: 0;
  margin-bottom: 32px;
}
.add-after {
  width: 44px; height: 44px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 22px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}
.add-after:hover {
  border-style: solid;
  border-color: var(--vscode-focusBorder);
  color: var(--vscode-focusBorder);
}

.parallel-group {
  position: relative;
  display: flex; flex-direction: column; align-items: stretch;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  padding: 14px 16px;
  background: rgba(45, 45, 48, 0.4);
  min-width: 200px;
}
.parallel-group:hover { border-color: var(--vscode-focusBorder); }
.parallel-header {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 10px;
  text-align: center;
}
.parallel-children {
  display: flex; flex-direction: row; gap: 28px;
  align-items: flex-start; justify-content: center;
  flex-wrap: wrap;
}
.parallel-add-child {
  margin-top: 12px;
  align-self: center;
  font-size: 11px;
}
`;
