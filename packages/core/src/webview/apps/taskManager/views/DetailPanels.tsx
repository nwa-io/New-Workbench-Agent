import { useRef, useState } from 'react';
import { useTaskManager } from '../store';
import { formatDateTime, statusClass } from '../model';

const DOCUMENT_ACCEPT = '.md,.txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.csv,.json,.xml';

export function DocumentDetail(): JSX.Element {
  const { state, actions } = useTaskManager();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const sources = state.taskState.sourceDocuments;
  const generated = state.taskState.documents;

  function handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) {
      return;
    }
    setStatus(`Importing ${files.length} file${files.length === 1 ? '' : 's'}...`);
    actions.uploadFiles(files);
  }

  return (
    <>
      <div className="detail-header">
        <h2>Documents</h2>
        <p className="detail-copy">Import source documents for this item; markitdown converts them to markdown.</p>
      </div>
      <div
        className={`drop-zone${dragging ? ' is-dragging' : ''}`}
        id="documentDropZone"
        onDragEnter={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="drop-zone-title">Drop documents here</div>
        <div className="drop-zone-copy">or</div>
        <button id="chooseDocumentBtn" type="button" onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          id="documentFileInput"
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          hidden
          onChange={e => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div id="uploadStatus" className="upload-status">
          {status}
        </div>
      </div>

      <DocList title="Source files" docs={sources} />
      <DocList title="Generated markdown" docs={generated} />
    </>
  );
}

function DocList({ title, docs }: { title: string; docs: { name: string; workspacePath: string }[] }): JSX.Element {
  const { actions } = useTaskManager();
  return (
    <div className="document-section">
      <div className="document-section-title">{title}</div>
      {docs.length === 0 ? (
        <p className="empty-state">None yet.</p>
      ) : (
        <div className="document-list">
          {docs.map(doc => (
            <div className="document-item" key={doc.workspacePath}>
              <span className="document-name">{doc.name}</span>
              <button type="button" className="secondary" onClick={() => actions.openDocument(doc.workspacePath)}>
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function JiraDetail(): JSX.Element {
  const { state, actions } = useTaskManager();
  const jira = state.jiraForm;
  const connection = state.taskState.jira;
  const ticket = connection?.ticket;

  return (
    <>
      <div className="detail-header">
        <h2>Jira</h2>
        <p className="detail-copy">Open the ticket in Chrome to sign in, then read it to capture the ticket markdown.</p>
      </div>
      <label className="form-field" htmlFor="jiraTaskLinkInput">
        <span>Ticket link</span>
        <input
          id="jiraTaskLinkInput"
          type="url"
          placeholder="https://your-domain.atlassian.net/browse/IWSP-4456"
          value={jira.link}
          onChange={e => actions.setJira({ link: e.target.value })}
        />
      </label>
      <div className="detail-action-row">
        <button type="button" disabled={jira.isOpening} onClick={actions.openJiraInChrome}>
          {jira.isOpening ? 'Opening...' : 'Open in Chrome'}
        </button>
        <button type="button" className="secondary" disabled={jira.isReading} onClick={actions.readJiraTicket}>
          {jira.isReading ? 'Reading...' : 'Read ticket'}
        </button>
      </div>
      {jira.message ? <p className={`jira-sync-status${jira.isError ? ' error' : ''}`}>{jira.message}</p> : null}

      <div className="jira-ticket-section">
        {!ticket ? (
          <p className="empty-state">No ticket read yet. Click “Read ticket” after signing in.</p>
        ) : (
          <>
            <div className="jira-ticket-field-title">{ticket.title}</div>
            {ticket.description ? <pre className="jira-ticket-content">{ticket.description}</pre> : null}
            {ticket.comments?.length ? (
              <div className="jira-comment-list">
                {ticket.comments.map((comment, i) => (
                  <div className="jira-comment" key={i}>
                    {comment}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="jira-ticket-meta">
              {ticket.key ? `${ticket.key} · ` : ''}Read: {formatDateTime(ticket.lastReadAt)}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function MarkdownDetail(): JSX.Element {
  const { state, actions } = useTaskManager();
  const step = state.selectedWorkflowStep;
  const isReviewHuman = step?.kind === 'step' && step.stepType === 'review_human';
  const node = state.taskState.nodes.find(n => n.id === 'markdown');

  return (
    <>
      <div className="detail-header">
        <h2>{node?.label || 'Markdown brief'}</h2>
        {node ? <span className={`status-badge status-${statusClass(node.status)}`}>{node.status}</span> : null}
        <p className="detail-copy">Condensed implementation brief generated for this item.</p>
      </div>
      <div className="detail-action-row">
        {isReviewHuman ? (
          <button type="button" onClick={actions.markStepDone}>
            Mark it done
          </button>
        ) : null}
        <button type="button" className={isReviewHuman ? 'secondary' : undefined} onClick={actions.openMarkdownDialog}>
          Open markdown
        </button>
      </div>
    </>
  );
}

export function CodeDetail(): JSX.Element {
  const { state } = useTaskManager();
  const node = state.taskState.nodes.find(n => n.id === 'code');
  const code = state.codeRun;
  return (
    <>
      <div className="detail-header">
        <h2>{node?.label || 'Code'}</h2>
        {node ? <span className={`status-badge status-${statusClass(node.status)}`}>{node.status}</span> : null}
        <p className="detail-copy">Claude Code execution for this task item.</p>
      </div>
      <div className={`code-run-panel${code.isRunning ? ' running' : ''}${code.isError ? ' error' : ''}`}>
        <div>
          <span className="code-run-label">Markdown brief</span>
          {code.markdownPath ? (
            <p>
              <code>{code.markdownPath}</code>
            </p>
          ) : (
            <p>
              <span>-</span>
            </p>
          )}
        </div>
        <p className="code-run-status">
          {code.message || (code.isRunning ? 'Claude Code terminal is running...' : 'Idle.')}
        </p>
      </div>
    </>
  );
}

export function GenericStepDetail(): JSX.Element {
  const { state } = useTaskManager();
  const step = state.selectedWorkflowStep;
  const status = step?.status || 'idle';
  const config = step && step.kind === 'step' ? step.config : undefined;
  return (
    <>
      <div className="detail-header">
        <h2>{step?.title || 'Workflow step'}</h2>
        <span className={`status-badge status-${statusClass(status)}`}>{status}</span>
        <p className="detail-copy">Current status: {status}</p>
      </div>
      {config ? (
        <div className="workflow-step-config">
          <div className="jira-ticket-field-title">Config</div>
          <pre className="jira-ticket-content">{JSON.stringify(config, null, 2)}</pre>
        </div>
      ) : null}
    </>
  );
}
