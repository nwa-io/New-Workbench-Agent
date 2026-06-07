import { Fragment } from 'react';
import type { WorkflowBlock, WorkflowStepBlock } from '@nwa/workflow-sdk';
import { stepIcon } from '@nwa/workflow-sdk';

export type StepLocator =
  | { type: 'root'; index: number }
  | { type: 'parallel-child'; parentIndex: number; childIndex: number };

export interface StepStatus {
  /** Sanitized class suffix used for border colour, e.g. `running`. */
  cls: string;
  /** Human label shown in the status badge. Omit to hide the badge. */
  label?: string;
}

interface WorkflowTreeProps {
  blocks: WorkflowBlock[];
  /** JSON.stringify of the selected locator; highlights the matching card. */
  selectedKey?: string;
  /** When set, step cards become clickable buttons (disabled while true). */
  onSelectStep?: (step: WorkflowStepBlock, locator: StepLocator) => void;
  disabled?: boolean;
  /** Live status for a step card (border colour + badge). */
  statusOf?: (step: WorkflowStepBlock) => StepStatus;
  /** Inline model/speed controls rendered inside the card (the "outer" picker). */
  renderModel?: (step: WorkflowStepBlock) => JSX.Element | null;
  /** Extra overlay for a step, e.g. an error tooltip. */
  renderExtra?: (step: WorkflowStepBlock) => JSX.Element | null;
}

export function WorkflowTree(props: WorkflowTreeProps): JSX.Element {
  const { blocks, selectedKey, onSelectStep, disabled, statusOf, renderModel, renderExtra } = props;

  function renderStepCard(step: WorkflowStepBlock, locator: StepLocator): JSX.Element {
    const status = statusOf?.(step);
    const statusCls = status?.cls || step.status || 'idle';
    const selected = selectedKey !== undefined && selectedKey === JSON.stringify(locator);
    const card = (
      <>
        <div className={`block-card status-${statusCls}`}>
          <div className="block-card-head">
            <span className="block-icon">{stepIcon(step.stepType)}</span>
            <span className="block-title" title={step.title}>
              {step.title}
            </span>
          </div>
          {renderModel?.(step)}
          {status?.label ? (
            <span className={`status-badge status-${statusCls}`}>{status.label}</span>
          ) : null}
        </div>
        {renderExtra?.(step)}
      </>
    );

    if (!onSelectStep) {
      return (
        <div className="block-wrap step-wrap" key={step.id}>
          {card}
        </div>
      );
    }
    return (
      <div
        className={`block-wrap step-wrap interactive${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
        key={step.id}
        onClick={() => {
          if (!disabled) {
            onSelectStep(step, locator);
          }
        }}
      >
        {card}
      </div>
    );
  }

  function renderBlock(block: WorkflowBlock, index: number): JSX.Element {
    if (block.kind === 'step') {
      return renderStepCard(block, { type: 'root', index });
    }
    const statusCls = block.status || 'idle';
    return (
      <div className="block-wrap parallel-wrap" key={block.id}>
        <div className={`parallel-group status-${statusCls}`}>
          <div className="parallel-header">⏸ Parallel</div>
          <div className="parallel-children">
            {block.children.map((child, ci) =>
              renderStepCard(child, { type: 'parallel-child', parentIndex: index, childIndex: ci })
            )}
          </div>
        </div>
        <div className="block-label">{block.title}</div>
        <div className="block-sublabel">parallel · {block.children.length} branches</div>
      </div>
    );
  }

  return (
    <div className="workflow-tree">
      {blocks.map((block, i) => (
        <Fragment key={block.id}>
          {i > 0 ? <div className="connector" /> : null}
          {renderBlock(block, i)}
        </Fragment>
      ))}
    </div>
  );
}
