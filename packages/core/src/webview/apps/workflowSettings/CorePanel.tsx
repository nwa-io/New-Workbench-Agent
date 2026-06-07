import { useEffect, useRef, useState } from 'react';
import type { CliToolStatusView, CoreSettingsView, SavePathSettingView } from '../../protocol';

export interface CoreStatus {
  message: string;
  isError: boolean;
}

interface CorePanelProps {
  coreSettings: CoreSettingsView | null;
  statuses: Record<string, CoreStatus | undefined>;
  onRefreshCli: () => void;
  onInstallCli: (id: string) => void;
  onAuthenticateCli: (id: string) => void;
  onSavePath: (value: string) => void;
  onResetPath: () => void;
}

type CoreNavId = 'core-integration' | 'core-save-path';

function cliCardClass(status: CliToolStatusView): string {
  if (!status.installed) {
    return 'error';
  }
  return status.authenticated ? 'success' : 'warning';
}

function cliStatusLabel(status: CliToolStatusView): string {
  if (!status.installed) {
    return 'Not installed';
  }
  return status.authenticated ? 'Authenticated' : 'Needs auth';
}

function StatusLine({ id, status }: { id: string; status?: CoreStatus }): JSX.Element {
  return (
    <p id={id} className={`field-status${status?.isError ? ' error' : ''}`}>
      {status?.message ?? ''}
    </p>
  );
}

export function CorePanel(props: CorePanelProps): JSX.Element {
  const { coreSettings, statuses } = props;
  const [pathInputs, setPathInputs] = useState<Record<string, string>>({});
  const [activeNav, setActiveNav] = useState<CoreNavId>('core-integration');
  const sectionRefs = useRef<Record<CoreNavId, HTMLElement | null>>({
    'core-integration': null,
    'core-save-path': null
  });

  // Seed editable path inputs from host state.
  useEffect(() => {
    if (!coreSettings) {
      return;
    }
    const seeded: Record<string, string> = {};
    coreSettings.savePaths.forEach(setting => {
      if (setting.editable) {
        seeded[setting.id] = setting.value;
      }
    });
    setPathInputs(seeded);
  }, [coreSettings]);

  function navigate(id: CoreNavId): void {
    setActiveNav(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function savePathRow(setting: SavePathSettingView): void {
    props.onSavePath(pathInputs[setting.id] ?? setting.value);
  }

  return (
    <div className="core-settings-layout">
      <nav className="settings-summary" aria-label="Core settings summary">
        <div className="summary-kicker">NWA Settings</div>
        <h1>Core settings</h1>
        <p>Manage shared integrations and workspace save paths used by NWA task workflows.</p>
        <a
          className={`summary-link${activeNav === 'core-integration' ? ' active' : ''}`}
          href="#core-integration"
          onClick={event => {
            event.preventDefault();
            navigate('core-integration');
          }}
        >
          <span>Integration</span>
          <small>Claude CLI, Codex CLI</small>
        </a>
        <a
          className={`summary-link${activeNav === 'core-save-path' ? ' active' : ''}`}
          href="#core-save-path"
          onClick={event => {
            event.preventDefault();
            navigate('core-save-path');
          }}
        >
          <span>Save Path</span>
          <small>Default workspace paths</small>
        </a>
      </nav>

      <main className="settings-main" aria-label="Core settings">
        <section
          id="core-integration"
          className="settings-section"
          ref={el => (sectionRefs.current['core-integration'] = el)}
        >
          <div className="section-heading">
            <p className="section-kicker">Integration</p>
            <h2>Integrations</h2>
            <p>Connect the local coding CLIs used by NWA task workflows.</p>
          </div>
          <div className="cli-settings">
            <div className="cli-settings-header">
              <div>
                <h3>CLI authentication</h3>
                <p>Check whether local coding CLIs are installed and signed in.</p>
              </div>
              <button
                id="refresh-cli-status"
                className="btn secondary"
                type="button"
                onClick={props.onRefreshCli}
              >
                Refresh
              </button>
            </div>
            <div id="cli-status-list" className="cli-status-list">
              {(coreSettings?.cliStatuses ?? []).length === 0 ? (
                <p className="field-status">CLI status is not available.</p>
              ) : (
                coreSettings!.cliStatuses.map(status => {
                  const cardClass = cliCardClass(status);
                  return (
                    <div className={`cli-status-card ${cardClass}`} key={status.id}>
                      <div className="cli-status-top">
                        <div>
                          <p className="cli-status-title">{status.label}</p>
                          {status.version ? (
                            <p className="cli-status-meta">{status.version}</p>
                          ) : null}
                        </div>
                        <span className={`status-pill ${cardClass}`}>{cliStatusLabel(status)}</span>
                      </div>
                      {status.message ? (
                        <p className="cli-status-message">{status.message}</p>
                      ) : null}
                      {!status.installed ? (
                        <div className="cli-status-actions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => props.onInstallCli(status.id)}
                          >
                            Run Init env
                          </button>
                        </div>
                      ) : !status.authenticated ? (
                        <div className="cli-status-actions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => props.onAuthenticateCli(status.id)}
                          >
                            Authenticate
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
            <StatusLine id="cli-status-status" status={statuses['cli-status-status']} />
          </div>
        </section>

        <section
          id="core-save-path"
          className="settings-section"
          ref={el => (sectionRefs.current['core-save-path'] = el)}
        >
          <div className="section-heading">
            <p className="section-kicker">Save Path</p>
            <h2>Default save paths</h2>
            <p>
              Review the workspace-relative paths NWA uses when it creates task data, workflow YAML,
              Figma cache files, and generated markdown.
            </p>
          </div>
          <div id="save-path-list" className="save-path-list">
            {(coreSettings?.savePaths ?? []).length === 0 ? (
              <p className="field-status">No save paths are available.</p>
            ) : (
              coreSettings!.savePaths.map(setting => {
                const editable = Boolean(setting.editable);
                return (
                  <div className="save-path-row" key={setting.id}>
                    <label className="save-path-title" htmlFor={`save-path-${setting.id}`}>
                      {setting.label}
                    </label>
                    <p className="save-path-description">{setting.description}</p>
                    <div className="save-path-control">
                      <input
                        id={`save-path-${setting.id}`}
                        type="text"
                        readOnly={!editable}
                        value={editable ? pathInputs[setting.id] ?? setting.value : setting.value}
                        onChange={
                          editable
                            ? event =>
                                setPathInputs(prev => ({ ...prev, [setting.id]: event.target.value }))
                            : undefined
                        }
                      />
                      {editable ? (
                        <>
                          <button className="btn" type="button" onClick={() => savePathRow(setting)}>
                            Save
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={props.onResetPath}
                          >
                            Reset
                          </button>
                        </>
                      ) : null}
                    </div>
                    <p className="save-path-meta">
                      Default: <code>{setting.defaultValue}</code>
                    </p>
                    {setting.configKey ? (
                      <p className="save-path-meta">
                        Config key: <code>{setting.configKey}</code>
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <StatusLine id="save-path-status" status={statuses['save-path-status']} />
        </section>
      </main>
    </div>
  );
}
