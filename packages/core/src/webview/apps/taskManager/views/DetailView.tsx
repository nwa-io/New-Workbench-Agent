import { defaultModelForStep } from '@nwa/workflow-sdk';
import type { TaskProcessNode, WorkflowStepBlock } from '@nwa/workflow-sdk';
import { useTaskManager } from '../store';
import { getDetailNodeIdForWorkflowStep, getWorkflowStepTitle, statusClass } from '../model';
import { DetailModal } from './DetailModal';
import { MarkdownDialog } from './MarkdownDialog';
import { WorkflowTree } from './WorkflowTree';

function displayStatus(step: WorkflowStepBlock, processNode: TaskProcessNode | undefined, codeRunning: boolean): string {
  if (step.status === 'running') {
    return 'Running';
  }
  if (step.status === 'failed') {
    return 'Failed';
  }
  if (step.status === 'success') {
    return 'Completed';
  }
  if (step.status === 'skipped') {
    return 'Skipped';
  }
  if (step.stepType === 'code' && codeRunning) {
    return 'Running';
  }
  return processNode?.status || 'Unknown';
}

export function DetailView(): JSX.Element {
  const { state, actions } = useTaskManager();
  const workflow = state.taskState.currentWorkflow;
  const nodes = state.taskState.nodes;
  const codeRunning = state.codeRun.isRunning;

  const runStatus: 'idle' | 'running' | 'finished' =
    codeRunning || state.workflowRun.status === 'running'
      ? 'running'
      : state.workflowRun.status === 'finished'
        ? 'finished'
        : 'idle';
  const running = runStatus === 'running';

  function nodeFor(step: WorkflowStepBlock): TaskProcessNode | undefined {
    const id = getDetailNodeIdForWorkflowStep(step);
    return nodes.find(n => n.id === id);
  }

  function statusOf(step: WorkflowStepBlock): { cls: string; label?: string } {
    const label = displayStatus(step, nodeFor(step), codeRunning);
    const cls = statusClass(label);
    // Badge only for active/terminal run states; idle steps stay clean like the NWA tree.
    const showBadge = cls === 'running' || cls === 'completed' || cls === 'failed' || cls === 'skipped';
    return { cls, label: showBadge ? label : undefined };
  }

  function renderModel(step: WorkflowStepBlock): JSX.Element | null {
    const effective = step.model ?? defaultModelForStep(step.stepType);
    if (effective === undefined) {
      return null;
    }
    const editable = step.status === 'idle' && !running;
    const options = [...state.availableModels];
    if (effective && !options.some(m => m.id === effective)) {
      options.unshift({ id: effective, label: effective, provider: 'claude' });
    }
    const selected = state.availableModels.find(m => m.id === effective);
    const speeds = selected?.speeds ?? [];
    const effectiveSpeed = step.modelSpeed ?? selected?.defaultSpeed;
    return (
      <div className="block-model-row" onClick={e => e.stopPropagation()}>
        <select
          className="block-model"
          title="Model"
          disabled={!editable}
          value={effective ?? ''}
          onChange={e => {
            const next = state.availableModels.find(m => m.id === e.target.value);
            const nextSpeed = next?.speeds && next.speeds.length > 0 ? next.defaultSpeed : undefined;
            actions.setStepModel(step.id, e.target.value, nextSpeed);
          }}
        >
          {options.map(model => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
        {speeds.length > 0 ? (
          <select
            className="block-speed"
            title="Speed (reasoning level)"
            disabled={!editable}
            value={effectiveSpeed ?? ''}
            onChange={e => actions.setStepSpeed(step.id, e.target.value)}
          >
            {speeds.map(speed => (
              <option key={speed} value={speed}>
                {speed}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  function renderExtra(step: WorkflowStepBlock): JSX.Element | null {
    const tooltip = state.workflowRun.errorTooltips[step.id];
    if (!tooltip) {
      return null;
    }
    return (
      <span className="workflow-error-tooltip" role="status">
        <span className="workflow-error-tooltip-text">{truncateError(tooltip)}</span>
        <span
          className="workflow-error-tooltip-close"
          role="button"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            actions.closeErrorTooltip(step.id);
          }}
        >
          ×
        </span>
      </span>
    );
  }

  const runLabel = runStatus === 'idle' ? 'RUN' : runStatus === 'running' ? 'RUNNING' : 'COMPLETED';

  return (
    <main className="task-detail-view" id="taskDetailView">
      <section className="task-block task-tree-block">
        <div className="block-header">
          <h2>Process</h2>
          <div className="task-tree-zoom-controls">
            <button title="Zoom out" onClick={() => actions.setZoom(state.taskTreeZoom - 0.1)}>
              −
            </button>
            <span className="zoom-level">{Math.round(state.taskTreeZoom * 100)}%</span>
            <button title="Zoom in" onClick={() => actions.setZoom(state.taskTreeZoom + 0.1)}>
              +
            </button>
            <button title="Reset zoom" onClick={() => actions.setZoom(1)}>
              ⊙
            </button>
          </div>
        </div>
        <p className="task-detail-meta" id="taskDocumentsFolder">
          Documents: {state.taskState.documentsFolder || '-'}
          {state.currentItem ? ` · ${state.currentItem.folderPath}` : ''}
        </p>

        <div className={`workflow-detail-canvas run-${runStatus}`}>
          <div className="workflow-detail-body">
            <div
              className="workflow-detail-zoom-surface"
              id="taskTreeZoomSurface"
              ref={el => {
                if (el) {
                  (el.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(state.taskTreeZoom);
                }
              }}
            >
              {workflow && workflow.blocks.length > 0 ? (
                <WorkflowTree
                  blocks={workflow.blocks}
                  selectedKey={state.selectedWorkflowStepKey}
                  onSelectStep={actions.selectWorkflowStep}
                  disabled={running}
                  statusOf={statusOf}
                  renderModel={renderModel}
                  renderExtra={renderExtra}
                />
              ) : (
                <div className="workflow-detail-empty">No workflow steps for this item.</div>
              )}
            </div>
          </div>
          <div className="workflow-detail-actionbar">
            <div className="workflow-detail-actions">
              {state.workflowRun.message ? <span className="workflow-run-message">{state.workflowRun.message}</span> : null}
              <button
                id="taskWorkflowRunButton"
                className={`workflow-run-button ${runStatus}`}
                disabled={runStatus === 'running'}
                onClick={actions.runWorkflow}
              >
                {runLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      {state.detailModalOpen ? <DetailModal /> : null}
      {state.markdownDialog.isOpen ? <MarkdownDialog /> : null}
    </main>
  );
}

function truncateError(message: string): string {
  return String(message)
    .replace(/WorkflowRunError:\s*/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

export { getWorkflowStepTitle };
