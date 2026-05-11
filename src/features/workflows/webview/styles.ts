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

.core-empty {
  display: flex; flex: 1;
  align-items: center; justify-content: center;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
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
