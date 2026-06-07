import { useEffect, useState } from 'react';
import { useHostMessage } from '../shared/useHostMessage';
import { post } from './messaging';
import { ToolIcon } from './ToolIcon';
import { tools } from '../../data/tools';
import { models } from '../../data/models';
import { departmentIcons } from '../../data/departments';
import { agentDescriptions } from '../../data/agentDescriptions';
import type { AgentManagerHostMessage, DepartmentView } from '../../protocol';

type DepartmentMap = Record<string, DepartmentView>;

export function App(): JSX.Element {
  const [departments, setDepartments] = useState<DepartmentMap>({});
  const [favoriteAgents, setFavoriteAgents] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [selectedModel, setSelectedModel] = useState('sonnet');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folder, setFolder] = useState('');

  useEffect(() => {
    post({ command: 'getDepartments' });
    post({ command: 'getFavorites' });
  }, []);

  useHostMessage<AgentManagerHostMessage>(message => {
    if (message.command === 'departmentsData') {
      setDepartments(message.data);
    } else if (message.command === 'favoritesData') {
      setFavoriteAgents(message.data || []);
    }
  });

  const query = searchQuery.toLowerCase();

  function departmentOf(agentId: string): string | null {
    for (const [deptId, dept] of Object.entries(departments)) {
      if (dept.agents?.includes(agentId)) {
        return deptId;
      }
    }
    return null;
  }

  function agentMatchesSearch(agent: string): boolean {
    if (!query) {
      return true;
    }
    return (
      agent.toLowerCase().includes(query) ||
      (agentDescriptions[agent] || '').toLowerCase().includes(query)
    );
  }

  function departmentMatchesSearch(deptId: string): boolean {
    const dept = departments[deptId];
    if (!dept || !query) {
      return true;
    }
    return dept.name.toLowerCase().includes(query) || dept.agents.some(agentMatchesSearch);
  }

  function toggleDepartment(deptId: string): void {
    setSelectedDepartments(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  }

  function toggleAgent(agentId: string, checked: boolean): void {
    setSelectedAgents(prev => {
      if (checked) {
        return prev.includes(agentId) ? prev : [...prev, agentId];
      }
      return prev.filter(id => id !== agentId);
    });
  }

  function toggleFavoriteChip(agentId: string): void {
    const isSelected = selectedAgents.includes(agentId);
    if (isSelected) {
      setSelectedAgents(prev => prev.filter(id => id !== agentId));
      return;
    }
    setSelectedAgents(prev => [...prev, agentId]);
    const deptId = departmentOf(agentId);
    if (deptId && !selectedDepartments.includes(deptId)) {
      setSelectedDepartments(prev => [...prev, deptId]);
    }
  }

  function selectAllDept(deptId: string, agents: string[], checked: boolean): void {
    setSelectedAgents(prev => {
      const set = new Set(prev);
      agents.forEach(agent => {
        if (checked) {
          set.add(agent);
        } else {
          set.delete(agent);
        }
      });
      return [...set];
    });
  }

  const toolFolder = tools.find(t => t.id === selectedTool)?.folder ?? '';
  const effectiveFolder = folder || toolFolder;
  const deptNames = selectedDepartments.map(id => departments[id]?.name).filter(Boolean);
  const showSummary = selectedAgents.length > 0;

  function install(): void {
    const agentPaths = selectedAgents
      .map(agentId => {
        const deptId = departmentOf(agentId);
        return deptId ? `${deptId}/${agentId}` : null;
      })
      .filter((path): path is string => Boolean(path));

    if (agentPaths.length === 0) {
      return;
    }

    const selectedDepts = [...new Set(agentPaths.map(path => path.split('/')[0]))];
    post({
      command: 'install',
      data: {
        tool: selectedTool,
        folder: effectiveFolder,
        departments: selectedDepts,
        agents: agentPaths,
        model: selectedTool === 'claude-code' ? selectedModel : undefined
      }
    });
  }

  return (
    <div className="container">
      <h1>🐙 New Workbench Agent Manager</h1>
      <p className="subtitle">Install and manage AI agents for your development workflow</p>

      <div className="search-container">
        <input
          type="text"
          id="searchInput"
          placeholder="Search agents..."
          className="search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button
          id="clearSearchBtn"
          className="search-clear"
          style={{ display: searchQuery ? 'block' : 'none' }}
          onClick={() => setSearchQuery('')}
        >
          Clear
        </button>
      </div>

      <div className="step">
        <div className="step-header">
          <div className="step-number">1</div>
          <div className="step-title">Select AI Tool</div>
        </div>
        <div className="tool-grid" id="toolGrid">
          {tools.map(tool => (
            <div
              className={`tool-card${tool.id === selectedTool ? ' selected' : ''}`}
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
            >
              <div className="selected-badge">Selected</div>
              <div className="tool-header">
                <ToolIcon slug={tool.icon} />
                <span className="tool-name">{tool.name}</span>
              </div>
              <div className="tool-desc">{tool.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {selectedTool === 'claude-code' ? (
        <div className="step" id="modelStep">
          <div className="step-header">
            <div className="step-number">2</div>
            <div className="step-title">Select Model</div>
          </div>
          <div className="model-grid" id="modelGrid">
            {models.map(model => (
              <div
                className={`model-card${model.id === selectedModel ? ' selected' : ''}`}
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
              >
                <div className="selected-badge">Selected</div>
                <div className="model-name">{model.name}</div>
                <div className="model-desc">{model.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="step">
        <div className="step-header">
          <div className="step-number">3</div>
          <div className="step-title">Select Departments</div>
        </div>
        <div className="department-grid" id="departmentGrid">
          {Object.entries(departments).map(([deptId, dept]) => (
            <div
              className={`department-card${selectedDepartments.includes(deptId) ? ' selected' : ''}`}
              key={deptId}
              style={{ display: departmentMatchesSearch(deptId) ? 'block' : 'none' }}
              onClick={() => toggleDepartment(deptId)}
            >
              <div className="selected-badge">Selected</div>
              <div className="department-header" data-dept-id={deptId}>
                <div className="department-info">
                  <div className="department-name-row">
                    <span className="department-icon">{departmentIcons[deptId] || '📁'}</span>
                    <div className="department-name">
                      {dept.name}
                      <span className="agent-count">{dept.agents.length}</span>
                    </div>
                  </div>
                  <div className="department-desc">{dept.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {favoriteAgents.length > 0 ? (
        <div className="favorites-section" id="favoritesSection">
          <div className="favorites-header">
            <span className="favorites-icon">★</span>
            <span className="favorites-title">Favorites</span>
          </div>
          <div className="favorites-grid" id="favoritesGrid">
            {favoriteAgents.map(agentId => {
              const isSelected = selectedAgents.includes(agentId);
              return (
                <div
                  className={`favorite-chip${isSelected ? ' selected' : ''}`}
                  key={agentId}
                  onClick={() => toggleFavoriteChip(agentId)}
                >
                  <span className="favorite-chip-star">★</span>
                  <span className="favorite-chip-name">{agentId}</span>
                  {isSelected ? <span className="favorite-chip-check">✓</span> : null}
                  <span
                    className="favorite-chip-remove"
                    title="Remove from favorites"
                    onClick={e => {
                      e.stopPropagation();
                      post({ command: 'toggleFavorite', data: { agentId } });
                    }}
                  >
                    ×
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedDepartments.length > 0 ? (
        <div className="step" id="agentsStep">
          <div className="step-header">
            <div className="step-number">4</div>
            <div className="step-title">Select Agents</div>
          </div>
          <div id="agentsList">
            {selectedDepartments.map(deptId => {
              const dept = departments[deptId];
              if (!dept) {
                return null;
              }
              const agents = dept.agents.filter(agentMatchesSearch);
              if (agents.length === 0) {
                return null;
              }
              const checkedCount = agents.filter(a => selectedAgents.includes(a)).length;
              const allChecked = checkedCount === agents.length && agents.length > 0;
              const indeterminate = checkedCount > 0 && checkedCount < agents.length;
              return (
                <div className="agents-list" key={deptId}>
                  <div className="select-all-container">
                    <div className="select-all-item">
                      <input
                        type="checkbox"
                        className="select-all-checkbox"
                        checked={allChecked}
                        ref={el => {
                          if (el) {
                            el.indeterminate = indeterminate;
                          }
                        }}
                        onChange={e => selectAllDept(deptId, agents, e.target.checked)}
                      />
                      <span onClick={() => selectAllDept(deptId, agents, !allChecked)}>
                        {dept.name} (Select All{query ? ' Filtered' : ''})
                      </span>
                    </div>
                  </div>
                  {agents.map(agent => {
                    const isFavorite = favoriteAgents.includes(agent);
                    const isSelected = selectedAgents.includes(agent);
                    return (
                      <div className="agent-item" key={agent}>
                        <input
                          type="checkbox"
                          className="agent-checkbox"
                          checked={isSelected}
                          onChange={e => toggleAgent(agent, e.target.checked)}
                        />
                        <div className="agent-details" onClick={() => toggleAgent(agent, !isSelected)}>
                          <div className="agent-name">{agent}</div>
                          <div className="agent-description">{agentDescriptions[agent] || ''}</div>
                        </div>
                        <span
                          className={`agent-favorite-btn${isFavorite ? ' is-favorite' : ''}`}
                          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          onClick={e => {
                            e.stopPropagation();
                            post({ command: 'toggleFavorite', data: { agentId: agent } });
                          }}
                        >
                          {isFavorite ? '★' : '☆'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="step">
        <div className="step-header">
          <div className="step-number">5</div>
          <div className="step-title">Folder Name (Optional)</div>
        </div>
        <input
          type="text"
          id="folderInput"
          placeholder="Leave empty for default"
          value={folder}
          onChange={e => setFolder(e.target.value)}
        />
        <div className="info-box">
          Default folders: <strong>.cursorrules</strong> (Cursor), <strong>.claude/agents</strong>{' '}
          (Claude Code), <strong>.github</strong> (Copilot), <strong>.aider</strong> (Aider),{' '}
          <strong>.ai</strong> (Universal)
        </div>
      </div>

      {showSummary ? (
        <div className="summary" id="summary">
          <div className="summary-item">
            <span className="summary-label">Tool:</span>
            <span className="summary-value">{tools.find(t => t.id === selectedTool)?.name}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Folder:</span>
            <span className="summary-value">{effectiveFolder}</span>
          </div>
          {selectedTool === 'claude-code' ? (
            <div className="summary-item" id="summaryModelItem" style={{ display: 'flex' }}>
              <span className="summary-label">Model:</span>
              <span className="summary-value">
                {models.find(m => m.id === selectedModel)?.name || 'Sonnet'}
              </span>
            </div>
          ) : null}
          <div className="summary-item">
            <span className="summary-label">Departments:</span>
            <span className="summary-value">{deptNames.join(', ') || 'None'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Agents:</span>
            <span className="summary-value">{selectedAgents.length} selected</span>
          </div>
        </div>
      ) : null}

      <div className="button-group">
        <button id="installBtn" disabled={selectedAgents.length === 0} onClick={install}>
          Install Agents
        </button>
        <button className="secondary" id="cancelBtn" onClick={() => post({ command: 'cancel' })}>
          Cancel
        </button>
      </div>
    </div>
  );
}
