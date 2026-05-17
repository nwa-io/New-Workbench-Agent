export function getJiraDetailScript(): string {
  return `
function renderJiraDetail(detail, activeNode) {
  const connection = taskState.jira;
  if (!jiraFormState.link && connection && connection.link) {
    jiraFormState.link = connection.link;
  }

  const status = activeNode?.status || 'Un-sync';
  const syncStatus = jiraFormState.message
    ? \`<p class="jira-sync-status\${jiraFormState.isError ? ' error' : ''}">\${escapeHtml(jiraFormState.message)}</p>\`
    : '';
  const ticketPanel = getJiraTicketPanelHtml(connection);

  detail.innerHTML = \`
    <div class="detail-header">
      <h2>\${escapeHtml(activeNode?.label || 'Jira')}</h2>
      <span class="status-badge status-\${statusClass(status)}">\${escapeHtml(status)}</span>
      <p class="detail-copy">Paste a Jira ticket URL. The workflow reads the ticket when RUN reaches this step.</p>
    </div>

    <label class="form-field" for="jiraTaskLinkInput">
      <span>Jira ticket URL</span>
      <input id="jiraTaskLinkInput" type="url" inputmode="url" autocomplete="off" placeholder="https://your-domain.atlassian.net/browse/KEY-123" value="\${escapeHtml(jiraFormState.link)}">
    </label>
    \${syncStatus}

    \${ticketPanel}
  \`;

  bindJiraDetail();
}

function bindJiraDetail() {
  const linkInput = document.getElementById('jiraTaskLinkInput');
  if (linkInput) {
    linkInput.oninput = () => {
      jiraFormState.link = linkInput.value;
    };
    linkInput.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        linkInput.blur();
      }
    };
  }
}

function captureJiraFields() {
  const linkInput = document.getElementById('jiraTaskLinkInput');
  if (linkInput) {
    jiraFormState.link = linkInput.value;
  }
}

function getJiraTicketPanelHtml(connection) {
  if (!connection || !connection.ticket) {
    return \`
      <div class="jira-ticket-section">
        <div class="jira-ticket-heading">
          <h3>Ticket content</h3>
          <span>Not read</span>
        </div>
        <p class="empty-state">Click RUN on the workflow board to read this Jira ticket.</p>
      </div>
    \`;
  }

  const ticket = connection.ticket;
  const comments = Array.isArray(ticket.comments) ? ticket.comments : [];
  const metaParts = [];
  if (ticket.key) {
    metaParts.push(ticket.key);
  }
  metaParts.push('Read: ' + formatDateTime(ticket.lastReadAt));
  const descriptionHtml = ticket.description
    ? \`<pre class="jira-ticket-content">\${escapeHtml(ticket.description)}</pre>\`
    : '<p class="empty-state">No description collected.</p>';
  const commentsHtml = comments.length > 0
    ? comments.map((comment, index) => \`
        <div class="jira-comment">
          <div class="jira-ticket-field-title">Comment \${index + 1}</div>
          <pre class="jira-ticket-content">\${escapeHtml(comment)}</pre>
        </div>
      \`).join('')
    : '<p class="empty-state">No comments collected.</p>';

  return \`
    <div class="jira-ticket-section">
      <div class="jira-ticket-heading">
        <h3>Ticket content</h3>
        <span>\${escapeHtml(metaParts.join(' - '))}</span>
      </div>
      <div class="jira-ticket-field">
        <div class="jira-ticket-field-title">Title</div>
        <div class="jira-ticket-title">\${escapeHtml(ticket.title)}</div>
      </div>
      <div class="jira-ticket-field">
        <div class="jira-ticket-field-title">Description</div>
        \${descriptionHtml}
      </div>
      <div class="jira-ticket-field">
        <div class="jira-ticket-field-title">Comments</div>
        \${commentsHtml}
      </div>
    </div>
  \`;
}
  `;
}
