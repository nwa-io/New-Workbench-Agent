import { useEffect, useRef, useState } from 'react';
import type {
  WorkflowBlock,
  WorkflowFile,
  WorkflowParallelBlock,
  WorkflowStepBlock,
  ModelOption
} from '@nwa/workflow-sdk';
import { defaultModelForStep, stepIcon } from '@nwa/workflow-sdk';
import type { WorkflowLocator } from '../../protocol';

interface WorkflowsPanelProps {
  workflows: WorkflowFile[];
  loading: boolean;
  activeId: string | null;
  availableModels: ModelOption[];
  onSetStepModel: (locator: WorkflowLocator, model: string) => void;
  onSetStepSpeed: (locator: WorkflowLocator, speed: string) => void;
  onSelectWorkflow: (id: string) => void;
  onNewWorkflow: () => void;
  onRenameWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onRenameInline: (id: string, name: string) => void;
  onAddStep: (locator: WorkflowLocator) => void;
  onAddParallelGroup: () => void;
  onAddParallelChild: (parentIndex: number) => void;
  onDeleteBlock: (locator: WorkflowLocator) => void;
  onValidate: () => void;
  onImport: () => void;
  onExport: () => void;
}

function locatorKey(locator: WorkflowLocator | null): string {
  return locator ? JSON.stringify(locator) : '';
}

export function WorkflowsPanel(props: WorkflowsPanelProps): JSX.Element {
  const { workflows, loading, activeId } = props;
  const activeWorkflow = workflows.find(w => w.id === activeId) ?? null;

  const [selectedLocator, setSelectedLocator] = useState<WorkflowLocator | null>(null);
  const [title, setTitle] = useState(activeWorkflow?.name ?? '');
  const [zoom, setZoom] = useState(1);
  const canvasBodyRef = useRef<HTMLDivElement>(null);

  // Reset selection + title when the active workflow changes.
  useEffect(() => {
    setSelectedLocator(null);
  }, [activeId]);

  useEffect(() => {
    setTitle(activeWorkflow?.name ?? '');
  }, [activeWorkflow?.id, activeWorkflow?.name]);

  useEffect(() => {
    if (canvasBodyRef.current) {
      // VS Code webviews run on Chromium, which supports the non-standard `zoom`.
      (canvasBodyRef.current.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(zoom);
    }
  }, [zoom]);

  function isSelected(locator: WorkflowLocator): boolean {
    return locatorKey(selectedLocator) === locatorKey(locator);
  }

  function selectBlock(event: React.MouseEvent, locator: WorkflowLocator): void {
    event.stopPropagation();
    setSelectedLocator(locator);
  }

  function renderModelControls(step: WorkflowStepBlock, locator: WorkflowLocator): JSX.Element | null {
    const effective = step.model ?? defaultModelForStep(step.stepType);
    // Steps with no default model (e.g. the manual Review by Human gate) run no model.
    if (effective === undefined) {
      return null;
    }
    // Always offer the current value, even if its provider is not authenticated.
    const options = [...props.availableModels];
    if (effective && !options.some(m => m.id === effective)) {
      options.unshift({ id: effective, label: effective, provider: 'claude' });
    }
    const selected = props.availableModels.find(m => m.id === effective);
    const speeds = selected?.speeds ?? [];
    const effectiveSpeed = step.modelSpeed ?? selected?.defaultSpeed;
    return (
      <div className="block-model-row">
        <select
          className="block-model"
          title="Model"
          value={effective ?? ''}
          onClick={event => event.stopPropagation()}
          onChange={event => {
            event.stopPropagation();
            props.onSetStepModel(locator, event.target.value);
          }}
        >
          {options.length === 0 ? (
            <option value="" disabled>
              No authenticated models
            </option>
          ) : (
            options.map(model => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))
          )}
        </select>
        {speeds.length > 0 ? (
          <select
            className="block-speed"
            title="Speed (reasoning level)"
            value={effectiveSpeed ?? ''}
            onClick={event => event.stopPropagation()}
            onChange={event => {
              event.stopPropagation();
              props.onSetStepSpeed(locator, event.target.value);
            }}
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

  function renderStepCard(
    step: WorkflowStepBlock,
    locator: WorkflowLocator,
    insertLocator: WorkflowLocator,
    handleClass: 'top' | 'left'
  ): JSX.Element {
    const icon = stepIcon(step.stepType);
    const status = step.status || 'idle';
    return (
      <div
        className={`block-wrap${isSelected(locator) ? ' selected' : ''}`}
        key={locatorKey(locator)}
        onClick={event => selectBlock(event, locator)}
      >
        <button
          className={`insert-handle ${handleClass}`}
          title="Insert step before"
          onClick={event => {
            event.stopPropagation();
            props.onAddStep(insertLocator);
          }}
        >
          +
        </button>
        <div className={`block-card status-${status}`}>
          <button
            className="block-delete"
            title="Delete"
            onClick={event => {
              event.stopPropagation();
              props.onDeleteBlock(locator);
            }}
          >
            ×
          </button>
          <div className="block-card-head">
            <span className="block-icon">{icon}</span>
            <span className="block-title" title={step.title}>
              {step.title}
            </span>
          </div>
          {renderModelControls(step, locator)}
        </div>
      </div>
    );
  }

  function renderParallel(block: WorkflowParallelBlock, index: number): JSX.Element {
    const rootLocator: WorkflowLocator = { type: 'root', index };
    const insertLocator: WorkflowLocator = { type: 'root', index: index - 1 };
    const status = block.status || 'idle';
    return (
      <div
        className={`block-wrap${isSelected(rootLocator) ? ' selected' : ''}`}
        style={{ width: 'auto' }}
        key={locatorKey(rootLocator)}
        onClick={event => selectBlock(event, rootLocator)}
      >
        <button
          className="insert-handle top"
          title="Insert step before"
          onClick={event => {
            event.stopPropagation();
            props.onAddStep(insertLocator);
          }}
        >
          +
        </button>
        <div className={`parallel-group status-${status}`}>
          <button
            className="block-delete"
            title="Delete group"
            onClick={event => {
              event.stopPropagation();
              props.onDeleteBlock(rootLocator);
            }}
          >
            ×
          </button>
          <div className="parallel-header">⏸ Parallel</div>
          <div className="parallel-children">
            {block.children.map((child, ci) =>
              renderStepCard(
                child,
                { type: 'parallel-child', parentIndex: index, childIndex: ci },
                { type: 'parallel-child', parentIndex: index, childIndex: ci - 1 },
                'left'
              )
            )}
          </div>
          <button
            className="btn secondary parallel-add-child"
            onClick={event => {
              event.stopPropagation();
              props.onAddParallelChild(index);
            }}
          >
            + Add branch
          </button>
        </div>
        <div className="block-label" title={block.title}>
          {block.title}
        </div>
        <div className="block-sublabel">parallel · {block.children.length} branches</div>
      </div>
    );
  }

  function renderBlock(block: WorkflowBlock, index: number): JSX.Element {
    if (block.kind === 'step') {
      return renderStepCard(
        block,
        { type: 'root', index },
        { type: 'root', index: index - 1 },
        'top'
      );
    }
    return renderParallel(block, index);
  }

  function renderCanvasBody(): JSX.Element {
    if (!activeWorkflow) {
      return <div className="tree-empty">Select or create a workflow.</div>;
    }
    const parts: JSX.Element[] = [];
    activeWorkflow.blocks.forEach((block, i) => {
      if (i > 0) {
        parts.push(<div className="connector" key={`connector-${i}`} />);
      }
      parts.push(renderBlock(block, i));
    });
    if (activeWorkflow.blocks.length > 0) {
      parts.push(<div className="connector" key="connector-end" />);
    }
    parts.push(
      <div className="add-after-wrap" key="add-after">
        <button
          className="add-after"
          title="Add next step"
          onClick={() => props.onAddStep({ type: 'root', index: activeWorkflow.blocks.length - 1 })}
        >
          +
        </button>
      </div>
    );
    return <div className="tree">{parts}</div>;
  }

  return (
    <div className="workflows-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Workflows</span>
          <button className="icon-btn" title="New workflow" onClick={props.onNewWorkflow}>
            +
          </button>
        </div>
        <div id="workflow-list" className="workflow-list">
          {loading ? (
            <div className="workflow-list-loading" role="status" aria-live="polite">
              <span className="workflow-list-spinner" aria-hidden="true" />
              <span>Loading workflows...</span>
            </div>
          ) : workflows.length === 0 ? (
            <div className="workflow-list-empty">No workflows yet. Click + to add one.</div>
          ) : (
            workflows.map(w => (
              <div
                className={`workflow-item${w.id === activeId ? ' active' : ''}`}
                key={w.id}
                onClick={() => {
                  if (w.id !== activeId) {
                    props.onSelectWorkflow(w.id);
                  }
                }}
              >
                <span className="name" title={w.name}>
                  {w.name}
                </span>
                <div className="actions">
                  <button
                    className="icon-btn"
                    title="Rename"
                    onClick={event => {
                      event.stopPropagation();
                      props.onRenameWorkflow(w.id);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={event => {
                      event.stopPropagation();
                      props.onDeleteWorkflow(w.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="canvas">
        <div className="canvas-header">
          <input
            id="canvas-title"
            className="canvas-title"
            type="text"
            placeholder="Workflow name"
            value={title}
            onChange={event => setTitle(event.target.value)}
            onBlur={() => {
              if (activeId) {
                props.onRenameInline(activeId, title);
              }
            }}
          />
          <div
            id="canvas-actions"
            className="canvas-actions"
            style={{ visibility: activeWorkflow ? 'visible' : 'hidden' }}
          >
            <button className="btn secondary" onClick={props.onAddParallelGroup}>
              Parallel group
            </button>
            <button className="btn" onClick={props.onValidate}>
              Validate
            </button>
            <button className="btn secondary" onClick={props.onImport}>
              Import
            </button>
            <button className="btn secondary" onClick={props.onExport}>
              Export
            </button>
          </div>
        </div>
        <div className="zoom-controls">
          <button title="Zoom out" onClick={() => setZoom(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}>
            −
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
            +
          </button>
          <button title="Reset zoom" onClick={() => setZoom(1)}>
            ⊙
          </button>
        </div>
        <div id="canvas-body" className="canvas-body" ref={canvasBodyRef}>
          {renderCanvasBody()}
        </div>
      </div>
    </div>
  );
}
