import { FigmaDetailPanel } from '@nwa/step-collect-figma/webview';
import { useTaskManager } from '../store';
import { getWorkflowStepTitle } from '../model';
import { post } from '../messaging';
import type { TaskManagerWebviewMessage } from '../../../protocol';
import { CodeDetail, DocumentDetail, GenericStepDetail, JiraDetail, MarkdownDetail } from './DetailPanels';

export function DetailModal(): JSX.Element {
  const { state, actions } = useTaskManager();
  const node = state.selectedNodeId;
  const step = state.selectedWorkflowStep;
  const title = step?.title || (step && step.kind === 'step' ? getWorkflowStepTitle(step.stepType) : 'Detail');

  let body: JSX.Element;
  switch (node) {
    case 'document':
      body = <DocumentDetail />;
      break;
    case 'figma':
      body = (
        <FigmaDetailPanel
          step={step}
          post={(command, data) => post({ command, data } as TaskManagerWebviewMessage)}
        />
      );
      break;
    case 'jira':
      body = <JiraDetail />;
      break;
    case 'markdown':
      body = <MarkdownDetail />;
      break;
    case 'code':
      body = <CodeDetail />;
      break;
    default:
      body = <GenericStepDetail />;
  }

  return (
    <div className="task-detail-modal-backdrop" id="taskDetailModal" onClick={actions.closeDetailModal}>
      <div className="task-detail-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="task-detail-modal-header">
          <h2>{title}</h2>
          <button id="closeTaskDetailModalBtn" className="task-detail-modal-close" type="button" onClick={actions.closeDetailModal}>
            ×
          </button>
        </div>
        <div className="task-detail-modal-body" id="taskDetail">
          {body}
        </div>
      </div>
    </div>
  );
}
