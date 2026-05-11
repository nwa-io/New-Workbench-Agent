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

[hidden] {
  display: none !important;
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

.task-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
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

.task-list-view,
.task-create-view {
  display: block;
}

.task-item-list {
  display: grid;
  gap: 10px;
}

.task-item-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
}

.task-item-card:hover {
  background: var(--vscode-list-hoverBackground);
}

.task-item-main {
  min-width: 0;
}

.task-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: var(--vscode-editor-foreground);
  font-size: 14px;
  font-weight: 700;
}

.task-item-meta,
.task-item-paths {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.task-item-paths {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.create-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(300px, 1.2fr);
  gap: 18px;
  align-items: start;
}

.create-form {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.create-stepper {
  display: grid;
  position: relative;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  overflow: hidden;
  padding: 18px;
  margin-bottom: 2px;
  background:
    linear-gradient(112deg, rgba(255, 255, 255, 0.05) 0 10%, transparent 10% 22%, rgba(255, 255, 255, 0.035) 22% 34%, transparent 34% 100%),
    #1d1a2d;
  border: 1px solid rgba(176, 184, 214, 0.16);
  border-radius: 8px;
}

.create-stepper-step {
  display: grid;
  grid-template-rows: 7px auto;
  gap: 14px;
  min-width: 0;
  padding: 0;
  color: var(--vscode-descriptionForeground);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: transform 140ms ease;
}

.create-stepper-step * {
  cursor: pointer;
}

.create-stepper-step:hover:not(:disabled) {
  background: transparent;
  transform: translateY(-1px);
}

.create-stepper-step:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 6px;
}

.create-stepper-track {
  display: block;
  height: 7px;
  overflow: hidden;
  background: #c8cedc;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.create-stepper-step.not-fill .create-stepper-track {
  background: #c8cedc;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
}

.create-stepper-step.on-select .create-stepper-track,
.create-stepper-step.active .create-stepper-track {
  background: #6d4df4;
  box-shadow: 0 0 0 1px rgba(109, 77, 244, 0.28), 0 0 18px rgba(109, 77, 244, 0.32);
}

.create-stepper-step.fill .create-stepper-track,
.create-stepper-step.complete .create-stepper-track {
  background: #36d99a;
  box-shadow: 0 0 0 1px rgba(54, 217, 154, 0.22), 0 0 18px rgba(54, 217, 154, 0.28);
}

.create-stepper-body {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.create-stepper-marker {
  position: relative;
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  color: #101624;
  background: transparent;
  border: 3px solid #c8cedc;
  border-radius: 999px;
  font-size: 0;
  font-weight: 700;
}

.create-stepper-step.not-fill .create-stepper-marker {
  background: transparent;
  border-color: #c8cedc;
}

.create-stepper-step.on-select .create-stepper-marker,
.create-stepper-step.active .create-stepper-marker {
  background: #6d4df4;
  border-color: #6d4df4;
  box-shadow: 0 0 0 4px rgba(109, 77, 244, 0.15);
}

.create-stepper-step.on-select .create-stepper-marker::after,
.create-stepper-step.active .create-stepper-marker::after {
  content: "";
  width: 8px;
  height: 8px;
  background: #ffffff;
  border-radius: 999px;
}

.create-stepper-step.fill .create-stepper-marker,
.create-stepper-step.complete .create-stepper-marker {
  background: #22c55e;
  border-color: #22c55e;
}

.create-stepper-step.fill .create-stepper-marker::before,
.create-stepper-step.complete .create-stepper-marker::before {
  content: "";
  width: 11px;
  height: 6px;
  border-left: 2px solid #102116;
  border-bottom: 2px solid #102116;
  transform: rotate(-45deg) translate(1px, -1px);
}

.create-stepper-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.create-stepper-title {
  overflow: hidden;
  color: rgba(246, 247, 251, 0.92);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-stepper-step.not-fill .create-stepper-title {
  color: rgba(246, 247, 251, 0.82);
}

.create-stepper-step.on-select .create-stepper-title,
.create-stepper-step.active .create-stepper-title {
  color: #ffffff;
}

.create-stepper-step.fill .create-stepper-title,
.create-stepper-step.complete .create-stepper-title {
  color: #ffffff;
}

.create-stepper-description {
  overflow: hidden;
  color: rgba(225, 229, 240, 0.62);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-stepper-step.not-fill .create-stepper-description {
  color: rgba(225, 229, 240, 0.54);
}

.create-stepper-step.on-select .create-stepper-description,
.create-stepper-step.active .create-stepper-description {
  color: rgba(216, 207, 255, 0.9);
}

.create-stepper-step.fill .create-stepper-description {
  color: rgba(210, 255, 233, 0.78);
}

.create-step-panel {
  min-height: 250px;
}

.item-type-switch {
  display: inline-flex;
  width: 100%;
  padding: 2px;
  margin-bottom: 16px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
}

.item-type-button {
  flex: 1;
  background: transparent;
  color: var(--vscode-foreground);
}

.item-type-button.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.create-status {
  min-height: 20px;
  margin-bottom: 12px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.create-status.error {
  color: var(--vscode-errorForeground);
}

.create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.workflow-layout-preview {
  min-height: 360px;
  overflow: hidden;
  padding: 0;
  background: var(--vscode-editor-background);
  background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 16px 16px;
  border: 1px solid rgba(150, 150, 170, 0.2);
  border-radius: 8px;
}

.workflow-layout-canvas {
  display: flex;
  flex-direction: column;
  min-height: 360px;
}

.workflow-layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.workflow-layout-title {
  max-width: 55%;
  overflow: hidden;
  color: var(--vscode-foreground);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-layout-file {
  max-width: 45%;
  overflow: hidden;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.4;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-layout-body {
  display: flex;
  min-height: 300px;
  justify-content: center;
  overflow: auto;
  padding: 32px 24px;
}

.workflow-layout-preview .tree {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  min-height: 200px;
}

.workflow-layout-preview .tree-empty {
  margin: auto;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
}

.workflow-layout-preview .tree-empty.compact {
  min-width: 120px;
  padding: 24px 10px;
  text-align: center;
}

.workflow-layout-preview .block-wrap {
  position: relative;
  display: flex;
  width: 140px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
}

.workflow-layout-preview .block-card {
  position: relative;
  display: flex;
  width: 110px;
  height: 110px;
  align-items: center;
  justify-content: center;
  background: rgba(45, 45, 48, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  transition: border-color 0.15s, transform 0.1s;
}

.workflow-layout-preview .block-card:hover {
  border-color: var(--vscode-focusBorder);
  transform: translateY(-1px);
}

.workflow-layout-preview .block-card.status-running {
  border-color: var(--vscode-progressBar-background);
}

.workflow-layout-preview .block-card.status-success {
  border-color: #4caf50;
}

.workflow-layout-preview .block-card.status-failed {
  border-color: var(--vscode-errorForeground);
}

.workflow-layout-preview .block-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  line-height: 1;
}

.workflow-layout-preview .block-label {
  max-width: 140px;
  overflow: hidden;
  margin-top: 14px;
  color: var(--vscode-foreground);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-layout-preview .block-sublabel {
  max-width: 140px;
  overflow: hidden;
  margin-top: 4px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-layout-preview .parallel-group {
  position: relative;
  display: flex;
  min-width: 200px;
  flex-direction: column;
  align-items: stretch;
  padding: 14px 16px;
  background: rgba(45, 45, 48, 0.4);
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 12px;
}

.workflow-layout-preview .parallel-group:hover {
  border-color: var(--vscode-focusBorder);
}

.workflow-layout-preview .parallel-group.status-running {
  border-color: var(--vscode-progressBar-background);
}

.workflow-layout-preview .parallel-group.status-success {
  border-color: #4caf50;
}

.workflow-layout-preview .parallel-group.status-failed {
  border-color: var(--vscode-errorForeground);
}

.workflow-layout-preview .parallel-header {
  margin-bottom: 10px;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  letter-spacing: 0.5px;
  text-align: center;
  text-transform: uppercase;
}

.workflow-layout-preview .parallel-children {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: 28px;
}

.workflow-layout-connector {
  width: 0;
  height: 32px;
  flex-shrink: 0;
  border-left: 1px dashed rgba(255, 255, 255, 0.35);
}

.workflow-mock {
  min-height: 300px;
  padding: 16px;
  background: #070711;
  border: 1px solid rgba(150, 150, 170, 0.2);
  border-radius: 8px;
}

.workflow-mock svg {
  display: block;
  width: 100%;
  height: auto;
  color: #f4f4f7;
}

.workflow-line {
  fill: none;
  stroke: rgba(218, 214, 232, 0.78);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.workflow-line.dashed {
  stroke-dasharray: 6 8;
  stroke: rgba(218, 214, 232, 0.52);
}

.workflow-node {
  fill: rgba(62, 65, 70, 0.96);
  stroke: rgba(205, 207, 218, 0.68);
  stroke-width: 2;
}

.workflow-node.circle {
  fill: rgba(45, 48, 60, 0.98);
}

.workflow-mock text {
  fill: #ffffff;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
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
  min-height: 500px;
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
  height: 500px;
  color: #f4f4f7;
}

.flow-connectors {
  position: absolute;
  inset: 0;
  width: 700px;
  height: 500px;
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
  transition: stroke 180ms ease, stroke-width 180ms ease, opacity 180ms ease;
}

.flow-line.source-line.ready,
.flow-line.code-line.running {
  stroke: #22c55e;
  stroke-width: 3;
  opacity: 0.95;
  animation: flow-dash-ready 1.1s linear infinite;
}

.flow-arrow {
  fill: rgba(218, 214, 232, 0.92);
  transition: fill 180ms ease;
}

.flow-arrow.running {
  fill: #22c55e;
}

@keyframes flow-dash-ready {
  from {
    stroke-dashoffset: 28;
  }

  to {
    stroke-dashoffset: 0;
  }
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

.flow-node.running {
  border-color: rgba(34, 197, 94, 0.88);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2), 0 14px 34px rgba(0, 0, 0, 0.34);
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
.status-sync,
.status-running {
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

.code-run-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
}

.code-run-panel.running {
  border-color: rgba(34, 197, 94, 0.72);
  box-shadow: inset 3px 0 0 #22c55e;
}

.code-run-panel.error {
  border-color: var(--vscode-inputValidation-errorBorder);
  box-shadow: inset 3px 0 0 var(--vscode-inputValidation-errorBorder);
}

.code-run-label {
  display: block;
  margin-bottom: 6px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.code-run-panel code {
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  word-break: break-word;
}

.code-run-status {
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.code-run-panel.error .code-run-status {
  color: var(--vscode-errorForeground);
}

.markdown-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.54);
}

.markdown-dialog {
  display: flex;
  width: min(920px, 96vw);
  max-height: min(760px, 92vh);
  flex-direction: column;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
}

.markdown-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.markdown-dialog-close {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  padding: 0;
  background: transparent;
  color: var(--vscode-icon-foreground);
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 20px;
  line-height: 1;
}

.markdown-dialog-close:hover {
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-panel-border);
}

.markdown-dialog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 8px;
}

.markdown-mode-switch {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
}

.markdown-mode-button {
  min-width: 84px;
  padding: 8px 12px;
  background: transparent;
  color: var(--vscode-foreground);
}

.markdown-mode-button.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.markdown-regenerate-button {
  padding: 8px 12px;
}

.markdown-dialog-status {
  min-height: 20px;
  padding: 0 18px;
  color: var(--vscode-descriptionForeground);
  font-size: 13px;
  line-height: 1.5;
}

.markdown-dialog-status.error {
  color: var(--vscode-errorForeground);
}

.markdown-dialog-body {
  min-height: 360px;
  overflow: hidden;
  padding: 12px 18px 18px;
}

.markdown-review,
.markdown-editor {
  width: 100%;
  min-height: 420px;
  max-height: 52vh;
  overflow: auto;
  padding: 12px;
  color: var(--vscode-editor-foreground);
  background: var(--vscode-textCodeBlock-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.markdown-editor {
  resize: vertical;
  outline: none;
}

.markdown-editor:focus {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}

.markdown-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 18px 18px;
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

.jira-ticket-field {
  margin-bottom: 12px;
}

.jira-ticket-field:last-child {
  margin-bottom: 0;
}

.jira-ticket-field-title {
  margin-bottom: 6px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  text-transform: uppercase;
}

.jira-ticket-title {
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.jira-comment + .jira-comment {
  margin-top: 10px;
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

.form-field input,
.form-field select {
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

.form-field select {
  min-height: 38px;
}

.form-field input:focus,
.form-field select:focus {
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
  grid-template-columns: auto minmax(0, 1fr) auto auto;
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

.figma-node-checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--vscode-checkbox-selectBackground);
  cursor: pointer;
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

.figma-node-copy-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--vscode-icon-foreground);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}

.figma-node-copy-button:hover {
  color: var(--vscode-button-foreground);
  background: var(--vscode-toolbar-hoverBackground);
  border-color: var(--vscode-panel-border);
}

.figma-node-copy-button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
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

@media (max-width: 820px) {
  .task-header {
    flex-direction: column;
  }

  .task-manager-grid {
    grid-template-columns: 1fr;
  }

  .create-grid {
    grid-template-columns: 1fr;
  }

  .create-stepper {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 14px;
  }

  .create-stepper-step {
    grid-template-rows: 7px auto;
  }

  .task-block {
    min-height: auto;
  }
}
`;
