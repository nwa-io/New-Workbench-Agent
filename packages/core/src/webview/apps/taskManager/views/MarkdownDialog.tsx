import { useTaskManager } from '../store';

export function MarkdownDialog(): JSX.Element {
  const { state, actions } = useTaskManager();
  const dialog = state.markdownDialog;
  const step = state.selectedWorkflowStep;
  const isReviewHuman = step?.kind === 'step' && step.stepType === 'review_human';
  const runLabel = isReviewHuman ? 'Mark it done' : 'Run';

  return (
    <div className="markdown-dialog-backdrop" id="taskMarkdownDialog" onClick={actions.closeMarkdownDialog}>
      <div className="markdown-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="markdown-dialog-header">
          <h2>Markdown</h2>
          <p className="detail-copy">Review or edit the implementation brief for this item.</p>
          <button id="closeMarkdownDialogBtn" className="markdown-dialog-close" type="button" onClick={actions.closeMarkdownDialog}>
            ×
          </button>
        </div>

        <div className="markdown-dialog-toolbar">
          <div className="markdown-mode-switch" role="tablist">
            <button
              className={`markdown-mode-button${dialog.mode === 'review' ? ' active' : ''}`}
              type="button"
              disabled={dialog.isLoading}
              onClick={() => actions.setMarkdownDialog({ mode: 'review' })}
            >
              Review
            </button>
            <button
              className={`markdown-mode-button${dialog.mode === 'edit' ? ' active' : ''}`}
              type="button"
              disabled={dialog.isLoading}
              onClick={() => actions.setMarkdownDialog({ mode: 'edit' })}
            >
              Edit
            </button>
          </div>
          <button
            id="regenerateMarkdownDialogBtn"
            className="secondary markdown-regenerate-button"
            type="button"
            disabled={dialog.isLoading || dialog.isRegenerating}
            onClick={actions.regenerateMarkdown}
          >
            {dialog.isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {dialog.message ? <p className={`markdown-dialog-status${dialog.isError ? ' error' : ''}`}>{dialog.message}</p> : null}

        <div className="markdown-dialog-body">
          {dialog.isLoading || dialog.mode === 'loading' ? (
            <p className="empty-state">Loading markdown brief...</p>
          ) : dialog.mode === 'edit' ? (
            <textarea
              id="taskMarkdownEditor"
              className="markdown-editor"
              value={dialog.content}
              onChange={e => actions.setMarkdownDialog({ content: e.target.value })}
            />
          ) : (
            <pre className="markdown-review">{dialog.content}</pre>
          )}
        </div>

        <div className="markdown-dialog-actions">
          <button id="cancelMarkdownDialogBtn" className="secondary" type="button" onClick={actions.closeMarkdownDialog}>
            Close
          </button>
          {dialog.mode === 'edit' ? (
            <button id="saveMarkdownDialogBtn" type="button" disabled={dialog.isSaving} onClick={actions.saveMarkdown}>
              {dialog.isSaving ? 'Saving...' : 'Save'}
            </button>
          ) : null}
          <button id="runMarkdownDialogBtn" type="button" disabled={dialog.isRunning} onClick={actions.runMarkdown}>
            {dialog.isRunning ? 'Running...' : runLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
