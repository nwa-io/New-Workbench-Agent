import type { TaskItemType, WorkflowFile } from '@nwa/workflow-sdk';
import { useTaskManager } from '../store';
import { WorkflowTree } from './WorkflowTree';

const STEP_META = [
  { step: 1, title: 'Select type', description: 'Task, bug, or analysis' },
  { step: 2, title: 'Name', description: 'Give the item an id' },
  { step: 3, title: 'Workflow', description: 'Pick a process' }
];

function workflowOptionLabel(workflow: WorkflowFile): string {
  return workflow.fileName ? `${workflow.fileName} - ${workflow.name}` : workflow.name;
}

export function CreateView(): JSX.Element {
  const { state, actions } = useTaskManager();
  const form = state.createForm;
  const workflows = state.taskState.workflows;
  const selectedWorkflow = workflows.find(w => w.id === form.workflowId) || null;

  function goToStep(step: number): void {
    actions.setCreateForm({ step: Math.max(1, Math.min(3, step)), isError: false, message: '' });
  }

  return (
    <main className="task-create-view" id="taskCreateView">
      <section className="task-block">
        <div className="create-form">
          <div className="create-stepper" aria-label="Create item steps">
            {STEP_META.map(meta => {
              const result =
                meta.step === 1
                  ? form.type
                  : meta.step === 2
                    ? form.id
                    : workflows.find(w => w.id === form.workflowId)?.name ?? '';
              const cls = form.step === meta.step ? ' active' : meta.step < form.step ? ' complete' : '';
              return (
                <button
                  key={meta.step}
                  className={`create-stepper-step${cls}`}
                  type="button"
                  onClick={() => goToStep(meta.step)}
                >
                  <span className="create-stepper-track" />
                  <span className="create-stepper-body">
                    <span className="create-stepper-marker">{meta.step}</span>
                    <span className="create-stepper-copy">
                      <span className="create-stepper-title">{meta.title}</span>
                      <span className="create-stepper-description">{meta.description}</span>
                      <span className="create-stepper-result">{result}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {form.step === 1 ? (
            <div className="create-step-panel" id="createStepTypePanel">
              <label className="form-field" htmlFor="createTypeSelect">
                <span>Type</span>
                <select
                  id="createTypeSelect"
                  value={form.type}
                  onChange={e => actions.setCreateForm({ type: e.target.value as TaskItemType })}
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="analysis">Analysis</option>
                </select>
              </label>
            </div>
          ) : null}

          {form.step === 2 ? (
            <div className="create-step-panel" id="createStepNamePanel">
              <label className="form-field" htmlFor="taskItemIdInput">
                <span>Name</span>
                <input
                  id="taskItemIdInput"
                  type="text"
                  placeholder="IWSP-4456"
                  value={form.id}
                  onChange={e => actions.setCreateForm({ id: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      goToStep(3);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}

          {form.step === 3 ? (
            <div className="create-step-panel" id="createStepWorkflowPanel">
              <label className="form-field" htmlFor="workflowLayoutSelect">
                <span>Workflow</span>
                <select
                  id="workflowLayoutSelect"
                  value={form.workflowId}
                  disabled={workflows.length === 0}
                  onChange={e => actions.setCreateForm({ workflowId: e.target.value })}
                >
                  {workflows.length === 0 ? <option value="">No workflows available</option> : null}
                  {workflows.map(workflow => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflowOptionLabel(workflow)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="workflow-layout-preview" id="workflowLayoutPreview">
                {selectedWorkflow ? (
                  <div className="workflow-layout-canvas">
                    <div className="workflow-layout-header">
                      <div className="workflow-layout-title">{selectedWorkflow.name}</div>
                      {selectedWorkflow.fileName ? <div className="workflow-layout-file">{selectedWorkflow.fileName}</div> : null}
                    </div>
                    <div className="workflow-layout-body">
                      <WorkflowTree blocks={selectedWorkflow.blocks} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {form.message ? <p className={`create-status${form.isError ? ' error' : ''}`}>{form.message}</p> : null}

          <div className="create-actions">
            <button className="secondary" id="taskCreateCancelBtn" type="button" onClick={() => actions.showView('list')}>
              Cancel
            </button>
            <button className="secondary" id="taskCreatePrevBtn" type="button" hidden={form.step === 1} onClick={() => goToStep(form.step - 1)}>
              Back
            </button>
            {form.step < 3 ? (
              <button id="taskCreateNextBtn" type="button" onClick={() => goToStep(form.step + 1)}>
                Next
              </button>
            ) : (
              <button id="taskCreateSubmitBtn" type="button" disabled={form.isCreating} onClick={actions.submitCreate}>
                {form.isCreating ? 'Creating...' : 'Create'}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
