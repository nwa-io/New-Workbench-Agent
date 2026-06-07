import { useEffect, useMemo, useState } from 'react';
import { useHostMessage } from '../shared/useHostMessage';
import { post } from './messaging';
import type {
  ClaudeResourceDescriptor,
  ClaudeResourceHostMessage,
  ClaudeResourceLayer
} from '../../protocol';

interface Catalog {
  layers: ClaudeResourceLayer[];
  resources: ClaudeResourceDescriptor[];
}

export function App(): JSX.Element {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isInstalling, setIsInstalling] = useState(false);

  // Ask the host for the resource catalog once mounted.
  useEffect(() => {
    post({ command: 'ready' });
  }, []);

  useHostMessage<ClaudeResourceHostMessage>(message => {
    switch (message.command) {
      case 'claudeResourceCatalog':
        setCatalog(message.data);
        break;
      case 'installClaudeResourcesComplete':
        setIsInstalling(false);
        setSelected(new Set());
        break;
      case 'installClaudeResourcesFailed':
        setIsInstalling(false);
        break;
    }
  });

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    catalog?.resources.forEach(resource => map.set(resource.id, resource.label));
    return map;
  }, [catalog]);

  const selectedIds = useMemo(() => [...selected], [selected]);
  const hasSelection = selectedIds.length > 0;

  function toggle(id: string): void {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection(): void {
    if (!isInstalling) {
      setSelected(new Set());
    }
  }

  function install(): void {
    if (!hasSelection || isInstalling) {
      return;
    }
    setIsInstalling(true);
    post({ command: 'installClaudeResources', resources: selectedIds });
  }

  const summary = !hasSelection
    ? 'No resources selected'
    : `${selectedIds.length} ${selectedIds.length === 1 ? 'resource' : 'resources'}: ` +
      selectedIds.map(id => labelById.get(id) ?? id).join(', ');

  return (
    <div className={`container${hasSelection ? ' has-install-bar' : ''}`}>
      <h1>Claude Resource Manager</h1>
      <p className="subtitle">
        Initialize Claude Code context resources by selecting files from each layer.
      </p>

      {(catalog?.layers ?? []).map(layer => (
        <section className="step" key={layer.layer}>
          <div className="step-header">
            <div className="step-number">{layer.layer}</div>
            <div className="step-meta">
              <div className="step-title">{layer.title}</div>
              <div className="step-name">{layer.name}</div>
            </div>
          </div>
          <div className="resource-list">
            {(catalog?.resources ?? [])
              .filter(resource => resource.layer === layer.layer)
              .map(resource => (
                <label className="resource-item" key={resource.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(resource.id)}
                    onChange={() => toggle(resource.id)}
                  />
                  <span className="resource-name">{resource.label}</span>
                </label>
              ))}
          </div>
        </section>
      ))}

      <div className={`install-bar${hasSelection ? ' visible' : ''}`} aria-live="polite">
        <div className="install-summary">
          <div className="install-title">Ready to install</div>
          <div className="install-detail">{summary}</div>
        </div>
        <div className="install-actions">
          <button
            id="cancel-install-claude-btn"
            type="button"
            disabled={isInstalling}
            onClick={clearSelection}
          >
            Clear
          </button>
          <button
            id="install-claude-btn"
            type="button"
            disabled={!hasSelection || isInstalling}
            onClick={install}
          >
            {isInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
