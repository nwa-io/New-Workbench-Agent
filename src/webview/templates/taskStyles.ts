export const taskStyles = `* {
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

button {
  padding: 10px 16px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
}

button:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button.secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

button.secondary:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.task-container {
  max-width: 1200px;
  margin: 0 auto;
}

.task-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

h1 {
  color: var(--vscode-editor-foreground);
  font-size: 28px;
  line-height: 1.2;
  margin-bottom: 8px;
}

h2 {
  color: var(--vscode-editor-foreground);
  font-size: 16px;
  line-height: 1.3;
}

.task-subtitle,
.block-meta,
.detail-copy,
.empty-state,
.document-path,
.upload-status {
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.mode-switch {
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
}

.mode-button {
  min-width: 86px;
  background: transparent;
  color: var(--vscode-foreground);
}

.mode-button.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.task-manager-grid {
  display: grid;
  grid-template-columns: minmax(420px, 1.05fr) minmax(360px, 0.95fr);
  gap: 16px;
  align-items: start;
}

.task-block {
  min-height: 460px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 18px;
}

.block-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.task-tree {
  min-height: 380px;
  overflow: auto;
  border: 1px solid rgba(150, 150, 170, 0.2);
  border-radius: 8px;
  background-color: #070711;
  background-image: radial-gradient(circle, rgba(170, 176, 210, 0.22) 1px, transparent 1px);
  background-position: 0 0;
  background-size: 20px 20px;
}

.flow-canvas {
  position: relative;
  width: 700px;
  height: 390px;
  color: #f4f4f7;
}

.flow-connectors {
  position: absolute;
  inset: 0;
  width: 700px;
  height: 390px;
  pointer-events: none;
}

.flow-line {
  fill: none;
  stroke: rgba(218, 214, 232, 0.82);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.flow-line.dashed {
  stroke: rgba(218, 214, 232, 0.62);
  stroke-dasharray: 6 8;
}

.flow-arrow {
  fill: rgba(218, 214, 232, 0.92);
}

.flow-node {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--w);
  height: var(--h);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: rgba(62, 65, 70, 0.96);
  color: #f7f7fb;
  border: 2px solid rgba(205, 207, 218, 0.68);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  text-align: left;
}

.flow-node:hover,
.flow-node.selected {
  border-color: #d5d6ff;
  box-shadow: 0 0 0 2px rgba(127, 139, 255, 0.2), 0 14px 34px rgba(0, 0, 0, 0.34);
}

.flow-node.selected {
  background: rgba(78, 82, 92, 0.98);
}

.flow-node.square {
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 12px;
}

.flow-node.circle {
  flex-direction: column;
  justify-content: center;
  width: var(--w);
  height: var(--h);
  border-radius: 999px;
  padding: 10px;
  background: rgba(45, 48, 60, 0.98);
  text-align: center;
}

.flow-icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f7f7fb;
}

.flow-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}

.flow-node.square .flow-icon,
.flow-node.circle .flow-icon {
  width: 42px;
  height: 42px;
}

.flow-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-node.wide .flow-title {
  font-size: 15px;
}

.flow-node .flow-icon + span {
  min-width: 0;
}

.flow-meta {
  display: block;
  max-width: 100%;
  overflow: hidden;
  margin-top: 3px;
  color: rgba(235, 235, 245, 0.62);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-node.circle .flow-meta {
  white-space: normal;
}

.flow-label {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--w);
  color: rgba(235, 235, 245, 0.76);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.flow-label.label-above {
  transform: translateY(-22px);
}

.flow-status {
  position: absolute;
  right: 10px;
  bottom: 9px;
}

.flow-node.circle .flow-status,
.flow-node.square .flow-status {
  position: static;
  margin-top: 2px;
}

.flow-port {
  position: absolute;
  width: 14px;
  height: 14px;
  background: #cbd0dc;
  border: 1px solid rgba(255, 255, 255, 0.58);
  transform: rotate(45deg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.flow-port.round {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  transform: none;
}

.flow-port.left {
  left: -8px;
  top: calc(50% - 7px);
}

.flow-port.right {
  right: -9px;
  top: calc(50% - 9px);
}

.flow-port.bottom-a {
  left: 48px;
  bottom: -8px;
}

.flow-port.bottom-b {
  left: 104px;
  bottom: -8px;
}

.flow-port.bottom-c {
  right: 48px;
  bottom: -8px;
}

.flow-plus {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dfe2f2;
  background: rgba(32, 35, 48, 0.92);
  border: 2px solid rgba(190, 194, 215, 0.72);
  border-radius: 6px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 3px 7px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid var(--vscode-badge-background);
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.status-ready,
.status-sync {
  background: var(--vscode-inputValidation-infoBackground);
  color: var(--vscode-inputValidation-infoForeground);
  border-color: var(--vscode-inputValidation-infoBorder);
}

.status-missing,
.status-un-sync {
  background: var(--vscode-inputValidation-warningBackground);
  color: var(--vscode-inputValidation-warningForeground);
  border-color: var(--vscode-inputValidation-warningBorder);
}

.status-unknown {
  background: var(--vscode-textBlockQuote-background);
  color: var(--vscode-descriptionForeground);
  border-color: var(--vscode-panel-border);
}

.detail-header {
  margin-bottom: 16px;
}

.detail-header h2 {
  margin-bottom: 6px;
}

.jira-flow-section {
  padding: 14px 0;
  border-top: 1px solid var(--vscode-panel-border);
}

.jira-flow-section:last-child {
  border-bottom: 1px solid var(--vscode-panel-border);
}

.jira-flow-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.jira-flow-heading h3 {
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  line-height: 1.3;
}

.jira-flow-list {
  display: grid;
  gap: 8px;
  list-style: none;
}

.jira-flow-list li {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-height: 34px;
  color: var(--vscode-foreground);
  font-size: 13px;
  line-height: 1.4;
}

.jira-step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--vscode-badge-foreground);
  background: var(--vscode-badge-background);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.jira-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.jira-sync-status {
  min-height: 20px;
  margin-bottom: 12px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.jira-sync-status.error {
  color: var(--vscode-errorForeground);
}

.jira-ticket-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--vscode-panel-border);
}

.jira-ticket-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.jira-ticket-heading h3 {
  color: var(--vscode-editor-foreground);
  font-size: 13px;
}

.jira-ticket-heading span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  text-align: right;
}

.jira-ticket-summary {
  margin-bottom: 10px;
}

.jira-ticket-title {
  overflow: hidden;
  margin-bottom: 4px;
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jira-ticket-content {
  max-height: 360px;
  overflow: auto;
  padding: 10px;
  color: var(--vscode-editor-foreground);
  background: var(--vscode-textCodeBlock-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.figma-tabs {
  display: inline-flex;
  width: 100%;
  padding: 2px;
  margin-bottom: 16px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
}

.figma-tab {
  flex: 1;
  background: transparent;
  color: var(--vscode-foreground);
}

.figma-tab.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.figma-panel {
  display: block;
}

.figma-panel[hidden] {
  display: none;
}

.form-field {
  display: block;
  margin-bottom: 14px;
}

.form-field span {
  display: block;
  margin-bottom: 6px;
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  font-weight: 600;
}

.form-field input {
  width: 100%;
  padding: 10px 11px;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.form-field input:focus {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}

.form-field input.attention {
  border-color: var(--vscode-inputValidation-warningBorder);
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.28);
}

.figma-actions {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.figma-sync-status {
  min-height: 20px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.figma-sync-status.error {
  color: var(--vscode-errorForeground);
}

.figma-connection-summary {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--vscode-panel-border);
}

.figma-connection-title {
  margin-bottom: 5px;
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  font-weight: 600;
}

.figma-node-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--vscode-panel-border);
}

.figma-node-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.figma-node-heading h3 {
  color: var(--vscode-editor-foreground);
  font-size: 13px;
}

.figma-node-heading span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.figma-node-list {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.figma-node-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 9px 10px 9px calc(10px + (var(--depth) * 12px));
  border-bottom: 1px solid var(--vscode-panel-border);
}

.figma-node-item:last-child {
  border-bottom: none;
}

.figma-node-item.selected {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.figma-node-main {
  min-width: 0;
}

.figma-node-name {
  overflow: hidden;
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-node-item.selected .figma-node-name {
  color: inherit;
}

.figma-node-path {
  overflow: hidden;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figma-node-item.selected .figma-node-path {
  color: inherit;
  opacity: 0.78;
}

.figma-node-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 92px;
}

.figma-node-meta span {
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  font-weight: 600;
}

.figma-node-meta code {
  color: var(--vscode-textPreformat-foreground);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
}

.figma-node-item.selected .figma-node-meta span,
.figma-node-item.selected .figma-node-meta code {
  color: inherit;
}

.drop-zone {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  padding: 18px;
  margin-bottom: 16px;
  background: var(--vscode-input-background);
  border: 2px dashed var(--vscode-input-border);
  border-radius: 8px;
  text-align: center;
}

.drop-zone.is-dragging {
  border-color: var(--vscode-focusBorder);
  background: var(--vscode-list-hoverBackground);
}

.drop-title {
  color: var(--vscode-editor-foreground);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

.drop-copy {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 14px;
}

.document-list {
  margin-top: 14px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 14px;
}

.document-list h3 {
  font-size: 13px;
  margin-bottom: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.document-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-button {
  flex-shrink: 0;
  padding: 6px 10px;
}

.upload-status {
  min-height: 20px;
  margin-top: 10px;
}

.upload-status.error {
  color: var(--vscode-errorForeground);
}

.task-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 820px) {
  .task-header {
    flex-direction: column;
  }

  .task-manager-grid {
    grid-template-columns: 1fr;
  }

  .task-block {
    min-height: auto;
  }
}
`;
