import { useEffect, useState } from 'react';
import type { WorkflowFile, ModelOption } from '@nwa/workflow-sdk';
import { useHostMessage } from '../shared/useHostMessage';
import { post } from './messaging';
import { CorePanel, CoreStatus } from './CorePanel';
import { WorkflowsPanel } from './WorkflowsPanel';
import type {
  CoreSettingsView,
  WorkflowSettingsHostMessage,
  WorkflowSettingsTab,
  WorkflowLocator
} from '../../protocol';

export function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<WorkflowSettingsTab>('core');
  const [coreSettings, setCoreSettings] = useState<CoreSettingsView | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CoreStatus | undefined>>({});
  const [workflows, setWorkflows] = useState<WorkflowFile[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    post({ command: 'ready' });
  }, []);

  function setStatus(id: string, message: string, isError: boolean): void {
    setStatuses(prev => ({ ...prev, [id]: { message, isError } }));
  }

  useHostMessage<WorkflowSettingsHostMessage>(message => {
    switch (message.command) {
      case 'setActiveTab':
        setActiveTab(message.data.tab);
        break;
      case 'setState': {
        const incoming = message.data;
        const nextWorkflows = incoming.workflows || [];
        setWorkflowsLoading(false);
        setWorkflows(nextWorkflows);
        setAvailableModels(incoming.availableModels || []);
        setActiveId(prev => {
          let next = incoming.activeId !== undefined ? incoming.activeId : prev;
          if (next && !nextWorkflows.find(w => w.id === next)) {
            next = nextWorkflows[0]?.id ?? null;
          }
          if (!next && nextWorkflows.length > 0) {
            next = nextWorkflows[0].id;
          }
          return next;
        });
        break;
      }
      case 'setCoreSettings':
        setCoreSettings(message.data);
        break;
      case 'coreSettingsSaved':
        setCoreSettings(message.data);
        setStatus(message.statusId || 'save-path-status', message.message || 'Settings saved.', false);
        break;
      case 'coreSettingsError':
        setStatus(message.statusId || 'save-path-status', message.message || 'Settings update failed.', true);
        break;
    }
  });

  // --- Core settings actions -------------------------------------------------

  function onRefreshCli(): void {
    post({ command: 'refreshCliStatus', data: {} });
    setStatus('cli-status-status', 'Refreshing CLI status...', false);
  }

  function onInstallCli(id: string): void {
    post({ command: 'installCli', data: { id } });
    setStatus('cli-status-status', 'Starting Init env...', false);
  }

  function onAuthenticateCli(id: string): void {
    post({ command: 'authenticateCli', data: { id } });
    setStatus('cli-status-status', 'Opening authentication terminal...', false);
  }

  function onSavePath(value: string): void {
    post({ command: 'saveTaskDocumentsFolder', data: { value } });
    setStatus('save-path-status', 'Saving path...', false);
  }

  function onResetPath(): void {
    post({ command: 'resetTaskDocumentsFolder', data: {} });
    setStatus('save-path-status', 'Resetting path...', false);
  }

  // --- Workflow builder actions ---------------------------------------------

  function onSelectWorkflow(id: string): void {
    setActiveId(id);
    post({ command: 'selectWorkflow', data: { id } });
  }

  function onAddStep(locator: WorkflowLocator): void {
    if (!activeId) {
      return;
    }
    post({ command: 'addStep', data: { workflowId: activeId, locator } });
  }

  function onAddParallelChild(parentIndex: number): void {
    if (!activeId) {
      return;
    }
    post({ command: 'addParallelChild', data: { workflowId: activeId, parentIndex } });
  }

  function onDeleteBlock(locator: WorkflowLocator): void {
    if (!activeId) {
      return;
    }
    post({ command: 'deleteBlock', data: { workflowId: activeId, locator } });
  }

  function onSetStepModel(locator: WorkflowLocator, model: string): void {
    if (!activeId) {
      return;
    }
    post({ command: 'setStepModel', data: { workflowId: activeId, locator, model } });
  }

  function onSetStepSpeed(locator: WorkflowLocator, speed: string): void {
    if (!activeId) {
      return;
    }
    post({ command: 'setStepSpeed', data: { workflowId: activeId, locator, speed } });
  }

  return (
    <div className="app">
      <div id="panel-core" className={`tab-panel${activeTab === 'core' ? ' active' : ''}`}>
        <CorePanel
          coreSettings={coreSettings}
          statuses={statuses}
          onRefreshCli={onRefreshCli}
          onInstallCli={onInstallCli}
          onAuthenticateCli={onAuthenticateCli}
          onSavePath={onSavePath}
          onResetPath={onResetPath}
        />
      </div>
      <div id="panel-workflows" className={`tab-panel${activeTab === 'workflows' ? ' active' : ''}`}>
        <WorkflowsPanel
          workflows={workflows}
          loading={workflowsLoading}
          activeId={activeId}
          availableModels={availableModels}
          onSetStepModel={onSetStepModel}
          onSetStepSpeed={onSetStepSpeed}
          onSelectWorkflow={onSelectWorkflow}
          onNewWorkflow={() => post({ command: 'createWorkflow', data: {} })}
          onRenameWorkflow={id => post({ command: 'renameWorkflow', data: { id } })}
          onDeleteWorkflow={id => post({ command: 'deleteWorkflow', data: { id } })}
          onRenameInline={(id, name) => post({ command: 'renameWorkflowInline', data: { id, name } })}
          onAddStep={onAddStep}
          onAddParallelGroup={() =>
            activeId && post({ command: 'addParallelGroup', data: { workflowId: activeId } })
          }
          onAddParallelChild={onAddParallelChild}
          onDeleteBlock={onDeleteBlock}
          onValidate={() => activeId && post({ command: 'validateWorkflow', data: { id: activeId } })}
          onImport={() => post({ command: 'importWorkflow', data: {} })}
          onExport={() => activeId && post({ command: 'exportWorkflow', data: { id: activeId } })}
        />
      </div>
    </div>
  );
}
