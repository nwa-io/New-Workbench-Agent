import type { TaskItemType, TaskManagerItem } from '@nwa/workflow-sdk';
import { useTaskManager } from '../store';
import type { ListFilter } from '../store';
import { itemTypeLabel, itemTypePluralLabel, modeToItemType, formatDateTime } from '../model';

type ProgressStatus = 'pending' | 'doing' | 'success';

function progressStatusOf(item: TaskManagerItem): ProgressStatus {
  const percent = item.summary?.progressPercent ?? 0;
  if (percent >= 100) {
    return 'success';
  }
  return percent <= 0 ? 'pending' : 'doing';
}

function progressStatusLabel(status: ProgressStatus): string {
  if (status === 'success') {
    return 'Success';
  }
  return status === 'doing' ? 'On-job doing' : 'Pending';
}

function progressColor(status: ProgressStatus): string {
  if (status === 'success') {
    return 'var(--vscode-charts-green, #4caf50)';
  }
  return status === 'doing' ? 'var(--vscode-charts-yellow, #f5a623)' : 'var(--vscode-descriptionForeground, #888)';
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m tokens`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k tokens`;
  }
  return `${value} tokens`;
}

function TrashIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

export function ListView(): JSX.Element {
  const { state, actions } = useTaskManager();
  const { mode, filter, listMessage, taskState, deleteConfirm, filterDialog } = state;
  const items = taskState.items;
  const activeType = modeToItemType(mode);

  const visible = items.filter(item => {
    if (mode === 'task') {
      if (!filter[item.type as keyof ListFilter]) {
        return false;
      }
      const status = progressStatusOf(item);
      if (!filter[status]) {
        return false;
      }
      if (filter.taskId.trim() && !item.id.toLowerCase().includes(filter.taskId.trim().toLowerCase())) {
        return false;
      }
      return true;
    }
    return item.type === activeType;
  });

  const chips = getFilterChips(filter);

  return (
    <main className="task-list-view" id="taskListView">
      <section className="task-block task-list-block">
        <div className="task-list-toolbar">
          {mode === 'task' && chips.length > 0 ? (
            <div className="task-filter-toolbar">
              <div className="task-filter-chips" id="taskFilterChips">
                {chips.map(chip => (
                  <span
                    className="task-filter-chip"
                    key={`${chip.kind}:${chip.value}`}
                    style={{ ['--chip-color' as string]: chip.color }}
                  >
                    <span className="task-filter-chip-leading" aria-hidden="true" />
                    <span className="task-filter-chip-title" title={chip.title}>
                      {chip.title}
                    </span>
                    <button
                      className="task-filter-chip-remove"
                      type="button"
                      title="Remove filter"
                      aria-label={`Remove ${chip.title}`}
                      onClick={() => actions.removeFilterChip(chip.kind, chip.value)}
                    >
                      <CloseIcon />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <p className="task-list-status" id="taskListStatus" aria-live="polite">
            {listMessage}
          </p>
        </div>

        <div className="task-item-list" id="taskItemList">
          {state.loading ? (
            <div className="task-list-loading" role="status" aria-live="polite">
              <span className="task-list-spinner" aria-hidden="true" />
              <span>Loading {itemTypePluralLabel(activeType).toLowerCase()}...</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="task-list-empty">No {itemTypePluralLabel(activeType).toLowerCase()} yet.</div>
          ) : (
            visible.map(item => {
              const status = progressStatusOf(item);
              const percent = Math.max(0, Math.min(100, item.summary?.progressPercent ?? 0));
              const issue = item.summary?.error
                ? { kind: 'error', text: item.summary.error }
                : item.summary?.warning
                  ? { kind: 'warning', text: item.summary.warning }
                  : item.summary?.currentFeature
                    ? { kind: 'current', text: `Current: ${item.summary.currentFeature}` }
                    : null;
              return (
                <div
                  className={`task-item-card status-${status}`}
                  key={`${item.type}:${item.id}`}
                  data-item-id={item.id}
                  data-item-type={item.type}
                  role="button"
                  tabIndex={0}
                  style={{ ['--task-progress' as string]: `${percent}%`, ['--task-progress-color' as string]: progressColor(status) }}
                  onClick={() => actions.selectTaskItem(item.id, item.type)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      actions.selectTaskItem(item.id, item.type);
                    }
                  }}
                >
                  <div className="task-item-main">
                    <div className="task-item-title">
                      <span className={`task-category-badge category-${item.type}`}>{itemTypeLabel(item.type)}</span>
                      <span className="task-item-name">{item.id}</span>
                    </div>
                    <div className="task-item-meta">
                      <span>{formatDateTime(item.updatedAt)}</span>
                      <span className="task-item-dot" aria-hidden="true">·</span>
                      <span>{progressStatusLabel(status)}</span>
                      <span className="task-item-dot" aria-hidden="true">·</span>
                      <span>{formatTokenCount(item.summary?.usageTokens ?? 0)}</span>
                    </div>
                    {issue ? <div className={`task-item-note ${issue.kind}`}>{issue.text}</div> : null}
                    <div className="task-item-paths">{item.folderPath}</div>
                  </div>
                  <div className="task-item-aside">
                    <span className="task-item-ring" aria-label={`${percent}% complete`}>
                      <span className="task-item-ring-track" />
                      <span className="task-item-ring-label">{percent}%</span>
                    </span>
                    <button
                      className="icon-button danger"
                      type="button"
                      title="Remove"
                      onClick={e => {
                        e.stopPropagation();
                        actions.openDeleteDialog(item.id, item.type);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {filterDialog.isOpen ? <FilterDialog /> : null}
      {deleteConfirm.isOpen ? <DeleteDialog /> : null}
    </main>
  );
}

interface FilterChip {
  kind: string;
  value: string;
  title: string;
  color: string;
}

// Accent colour per filter kind, tuned for the dark theme (GitHub-dark palette).
const CHIP_COLORS = {
  taskId: '#7d8590',
  pending: '#8b949e',
  doing: '#58a6ff',
  success: '#3fb950',
  task: '#a371f7',
  bug: '#f85149',
  analysis: '#388bfd'
} as const;

// Surface every active filter selection as a chip: a set Task ID plus each
// checked Status / Category. This lets the user see at a glance which filters
// are applied; removing a chip drops that selection.
function getFilterChips(filter: ListFilter): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filter.taskId.trim()) {
    chips.push({ kind: 'taskId', value: filter.taskId, title: `ID: ${filter.taskId.trim()}`, color: CHIP_COLORS.taskId });
  }
  const statusLabels: Record<string, string> = { pending: 'Pending', doing: 'On-job doing', success: 'Success' };
  (['pending', 'doing', 'success'] as const).forEach(key => {
    if (filter[key]) {
      chips.push({ kind: 'status', value: key, title: statusLabels[key], color: CHIP_COLORS[key] });
    }
  });
  const catLabels: Record<string, string> = { task: 'Task', bug: 'Bug', analysis: 'Analysis' };
  (['task', 'bug', 'analysis'] as const).forEach(key => {
    if (filter[key]) {
      chips.push({ kind: 'category', value: key, title: catLabels[key], color: CHIP_COLORS[key] });
    }
  });
  return chips;
}

function CloseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function FilterDialog(): JSX.Element {
  const { state, actions } = useTaskManager();
  const d = state.filterDialog;
  return (
    <div className="filter-dialog-backdrop" id="taskFilterDialog" onClick={actions.closeFilterDialog}>
      <div
        className="filter-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taskFilterDialogTitle"
        onClick={e => e.stopPropagation()}
      >
        <div className="filter-dialog-header">
          <h2 id="taskFilterDialogTitle">Filter tasks</h2>
          <button className="icon-button" type="button" title="Close" aria-label="Close" onClick={actions.closeFilterDialog}>
            <CloseIcon />
          </button>
        </div>

        <div className="filter-dialog-body">
          <label className="filter-field" htmlFor="taskFilterIdInput">
            <span>Task ID</span>
            <input
              id="taskFilterIdInput"
              type="text"
              placeholder="IWSP-4456"
              value={d.taskId}
              onChange={e => actions.setFilterDialog({ taskId: e.target.value })}
            />
          </label>

          <fieldset className="filter-section">
            <legend>Status</legend>
            {(['pending', 'doing', 'success'] as const).map(key => (
              <label className="filter-option" key={key}>
                <input type="checkbox" checked={d[key]} onChange={e => actions.setFilterDialog({ [key]: e.target.checked })} />
                <span>{key === 'pending' ? 'Pending' : key === 'doing' ? 'On-job doing' : 'Success'}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="filter-section">
            <legend>Categories</legend>
            {(['task', 'bug', 'analysis'] as const).map(key => (
              <label className="filter-option" key={key}>
                <input type="checkbox" checked={d[key]} onChange={e => actions.setFilterDialog({ [key]: e.target.checked })} />
                <span>{key === 'task' ? 'Task' : key === 'bug' ? 'Bug' : 'Analysis'}</span>
              </label>
            ))}
          </fieldset>

          {d.message ? <p className={`filter-dialog-status${d.isError ? ' error' : ''}`}>{d.message}</p> : null}
        </div>

        <div className="filter-dialog-actions">
          <button className="secondary" type="button" onClick={actions.closeFilterDialog}>
            Cancel
          </button>
          <button type="button" onClick={actions.applyFilterDialog}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog(): JSX.Element {
  const { state, actions } = useTaskManager();
  const d = state.deleteConfirm;
  const typeLabel = d.type ? itemTypeLabel(d.type as TaskItemType) : 'item';
  return (
    <div className="delete-dialog-backdrop" id="taskDeleteConfirmDialog" onClick={actions.closeDeleteDialog}>
      <div className="delete-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2 id="taskDeleteConfirmTitle">Remove {typeLabel}</h2>
        <p>
          Remove {typeLabel.toLowerCase()} <strong>{d.id}</strong> and its task folder?
        </p>
        <p className="delete-dialog-copy">This removes the generated task data on disk and cannot be undone.</p>
        <div className="create-actions">
          <button id="cancelTaskDeleteDialogBtn" className="secondary" type="button" disabled={d.isDeleting} onClick={actions.closeDeleteDialog}>
            Cancel
          </button>
          <button id="removeTaskDeleteDialogBtn" className="danger" type="button" disabled={d.isDeleting} onClick={actions.confirmDelete}>
            {d.isDeleting ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
