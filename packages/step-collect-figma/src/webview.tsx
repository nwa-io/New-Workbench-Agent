/**
 * React detail panel for the Collect Figma step, rendered inside the Task Manager
 * webview bundle (core imports it from `@nwa/step-collect-figma/webview`). It is
 * self-contained: it posts the host's fixed Figma commands through `props.post`
 * and mirrors the host's `figmaBridgeDetail` replies into local state via a
 * `window` message listener, so it owns no core store state. Styling reuses the
 * global Task Manager stylesheet (`figma-*` classes).
 */
import { useEffect, useMemo, useState } from 'react';

interface FigmaBridgeStatus {
  running?: boolean;
  connected?: boolean;
  port?: number;
  url?: string;
}

interface FigmaCaptureItem {
  name?: string;
  id?: string;
  type?: string;
  parentName?: string;
  width?: number;
  height?: number;
}

interface FigmaBridgeDetail {
  status?: FigmaBridgeStatus;
  items?: FigmaCaptureItem[];
  receivedAt?: string;
  fileName?: string;
  fileKey?: string;
  pageName?: string;
  contextPath?: string;
}

type PostFn = (command: string, data?: unknown) => void;

const DEFAULT_URL = 'ws://localhost:8080';

export function FigmaDetailPanel({ post }: { post: PostFn; step?: unknown }): JSX.Element {
  const [detail, setDetail] = useState<FigmaBridgeDetail | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      const message = event.data as { command?: string; data?: unknown } | undefined;
      if (!message || typeof message.command !== 'string') {
        return;
      }
      if (message.command === 'figmaBridgeDetail') {
        setDetail(message.data as FigmaBridgeDetail);
        setIsBusy(false);
        setError('');
      } else if (message.command === 'figmaBridgeDetailFailed') {
        setIsBusy(false);
        setError((message.data as { message?: string })?.message || 'Unable to reach the Figma bridge.');
      }
    }

    window.addEventListener('message', onMessage);
    post('getFigmaBridgeDetail');
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = detail?.status || {};
  const statusKind = status.running ? (status.connected ? 'connected' : 'running') : 'stopped';
  const stateLabel = status.running
    ? status.connected
      ? 'Plugin connected'
      : 'Listening for plugin'
    : 'Bridge offline';
  const url = status.url || DEFAULT_URL;

  const items = detail?.items || [];
  const types = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => item.type && set.add(item.type));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (activeType !== 'all' && item.type !== activeType) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [item.name, item.type, item.id, item.parentName]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(needle));
    });
  }, [items, query, activeType]);

  function runAction(command: string): void {
    setIsBusy(true);
    setError('');
    post(command);
  }

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((item, i) => selected.has(keyOf(item, i)));

  function toggleSelectAll(): void {
    setSelected(prev => {
      const next = new Set(prev);
      const keys = filtered.map((item, i) => keyOf(item, i));
      const shouldSelect = !allVisibleSelected;
      keys.forEach(key => (shouldSelect ? next.add(key) : next.delete(key)));
      return next;
    });
  }

  return (
    <>
      <div className="detail-header">
        <h2>Figma bridge</h2>
        <p className="detail-copy">
          Scan a frame in the <strong>Figma Clarity</strong> plugin and stream its design spec straight into this task
          over the local bridge.
        </p>
      </div>

      <div className={`figma-conn-card ${statusKind}`}>
        <div className="figma-conn-main">
          <span className={`figma-status-dot ${statusKind}`} aria-hidden="true" />
          <div className="figma-conn-text">
            <div className="figma-conn-state">{stateLabel}</div>
            <code className="figma-conn-url">{url}</code>
          </div>
        </div>
        <div className="figma-conn-actions">
          {status.running ? (
            <button type="button" className="figma-btn danger" disabled={isBusy} onClick={() => runAction('stopFigmaMcpBridge')}>
              ■ Stop
            </button>
          ) : (
            <button type="button" className="figma-btn primary" disabled={isBusy} onClick={() => runAction('startFigmaMcpBridge')}>
              ▶ Start bridge
            </button>
          )}
          <button type="button" className="figma-btn" disabled={isBusy} onClick={() => runAction('getFigmaBridgeDetail')}>
            ⟳ Refresh
          </button>
          <button type="button" className="figma-btn" onClick={() => post('openFigmaDesktop', { fileKey: detail?.fileKey })}>
            ↗ Open Figma
          </button>
        </div>
      </div>

      <ol className="figma-steps">
        <li className={status.running ? 'done' : 'active'}>Start the bridge</li>
        <li className={status.connected ? 'done' : status.running ? 'active' : ''}>
          Open Figma, run <strong>Plugins → Development → Figma Clarity</strong>
        </li>
        <li className={items.length > 0 ? 'done' : ''}>Scan a frame to capture it here</li>
      </ol>

      {error ? <p className="figma-sync-status error">{error}</p> : null}

      <section className="figma-capture">
        <div className="figma-capture-head">
          <h3>Captured nodes</h3>
          <span className="figma-count">{items.length}</span>
          {detail?.receivedAt ? <span className="figma-capture-time">{formatTime(detail.receivedAt)}</span> : null}
        </div>

        {detail?.fileName || detail?.pageName || detail?.fileKey ? (
          <div className="figma-context-meta">
            {detail.fileName ? <span>File: {detail.fileName}</span> : null}
            {detail.pageName ? <span>Page: {detail.pageName}</span> : null}
            {detail.fileKey ? <span>Key: {detail.fileKey}</span> : null}
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="empty-state">
            No nodes captured yet — start the bridge, then hit <strong>Scan &amp; Send to VS Code</strong> in the plugin.
          </p>
        ) : (
          <>
            <div className="figma-capture-toolbar">
              <input
                type="search"
                className="figma-search"
                placeholder="Search nodes by name, type or id…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <div className="figma-type-chips">
                <button
                  type="button"
                  className={`figma-type-chip${activeType === 'all' ? ' active' : ''}`}
                  onClick={() => setActiveType('all')}
                >
                  All
                </button>
                {types.map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`figma-type-chip${activeType === type ? ' active' : ''}`}
                    onClick={() => setActiveType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="figma-capture-selbar">
              <label className="figma-selectall">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                <span>{allVisibleSelected ? 'Clear' : 'Select all'}</span>
              </label>
              <span className="figma-selcount">
                {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} shown`}
              </span>
            </div>

            <div className="figma-cap-list">
              {filtered.map((item, i) => {
                const key = keyOf(item, i);
                const isOpen = expanded.has(key);
                return (
                  <div key={key} className={`figma-cap-row${selected.has(key) ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      className="figma-cap-checkbox"
                      checked={selected.has(key)}
                      onChange={() => setSelected(prev => toggle(prev, key))}
                    />
                    <button type="button" className="figma-cap-main" onClick={() => setExpanded(prev => toggle(prev, key))}>
                      <span className="figma-cap-name">{item.name || '(unnamed)'}</span>
                      <span className="figma-cap-sub">
                        {item.parentName ? `in ${item.parentName}` : 'top level'}
                        {dimsLabel(item) ? ` · ${dimsLabel(item)}` : ''}
                      </span>
                    </button>
                    <span className="figma-badge">{item.type || 'NODE'}</span>
                    <span className={`figma-cap-caret${isOpen ? ' open' : ''}`} aria-hidden="true">
                      ▸
                    </span>
                    {isOpen ? (
                      <dl className="figma-cap-detail">
                        {item.id ? (
                          <>
                            <dt>Id</dt>
                            <dd>
                              <code>{item.id}</code>
                            </dd>
                          </>
                        ) : null}
                        <dt>Type</dt>
                        <dd>{item.type || 'NODE'}</dd>
                        {item.parentName ? (
                          <>
                            <dt>Parent</dt>
                            <dd>{item.parentName}</dd>
                          </>
                        ) : null}
                        {dimsLabel(item) ? (
                          <>
                            <dt>Size</dt>
                            <dd>{dimsLabel(item)}</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
                );
              })}
              {filtered.length === 0 ? <p className="empty-state">No nodes match this filter.</p> : null}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function keyOf(item: FigmaCaptureItem, index: number): string {
  return item.id || `${item.name || 'node'}-${index}`;
}

function dimsLabel(item: FigmaCaptureItem): string {
  if (item.width === undefined || item.height === undefined) {
    return '';
  }
  return `${Math.round(item.width)} × ${Math.round(item.height)}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
