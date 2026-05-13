import {
  DEFAULT_TASK_DOCUMENTS_FOLDER,
  JIRA_MARKDOWN_FILE_NAME,
  PROJECT_FIGMA_FOLDER,
  PROJECT_FOLDER,
  TASK_ITEM_FOLDERS,
  TASK_ITEM_METADATA_FILE_NAME
} from '../../services/TaskManagerService';
import { CONFIG_KEYS } from '../../utils/constants';
import { WORKFLOWS_DIR } from './WorkflowStorageService';

export const FIGMA_ACCESS_TOKEN_SECRET_KEY = 'nwa.integration.figmaAccessToken';

export interface SavePathSetting {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
  editable?: boolean;
  configKey?: string;
}

export function getCoreSavePathSettings(taskDocumentsFolder: string): SavePathSetting[] {
  return [
    {
      id: 'project-folder',
      label: 'Project folder',
      description: 'Workspace-relative root folder for NWA task data.',
      value: PROJECT_FOLDER,
      defaultValue: PROJECT_FOLDER
    },
    {
      id: 'task-documents',
      label: 'Task documents',
      description: 'Markdown files imported or converted by the Task Manager.',
      value: taskDocumentsFolder || DEFAULT_TASK_DOCUMENTS_FOLDER,
      defaultValue: DEFAULT_TASK_DOCUMENTS_FOLDER,
      editable: true,
      configKey: CONFIG_KEYS.TASK_DOCUMENTS_FOLDER
    },
    {
      id: 'workflows',
      label: 'Workflow YAML',
      description: 'Workflow definitions used by NWA Task workflow selection.',
      value: `${WORKFLOWS_DIR}/*.workflow.yaml`,
      defaultValue: `${WORKFLOWS_DIR}/*.workflow.yaml`
    },
    {
      id: 'task-items',
      label: 'Task and bug items',
      description: 'Folders for task and bug item metadata plus generated markdown briefs.',
      value: `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS.task}/{id}`,
      defaultValue: `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS.task}/{id}`
    },
    {
      id: 'analysis-items',
      label: 'Analysis items',
      description: 'Folders for analysis item metadata plus generated markdown briefs.',
      value: `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS.analysis}/{id}`,
      defaultValue: `${PROJECT_FOLDER}/${TASK_ITEM_FOLDERS.analysis}/{id}`
    },
    {
      id: 'item-metadata',
      label: 'Item metadata',
      description: 'Per-item metadata file created when a task, bug, or analysis item is added.',
      value: `${PROJECT_FOLDER}/{type}/{id}/${TASK_ITEM_METADATA_FILE_NAME}`,
      defaultValue: `${PROJECT_FOLDER}/{type}/{id}/${TASK_ITEM_METADATA_FILE_NAME}`
    },
    {
      id: 'figma-cache',
      label: 'Figma cache',
      description: 'Synced Figma file and node metadata cache.',
      value: `${PROJECT_FIGMA_FOLDER}/{type}-{id}.json`,
      defaultValue: `${PROJECT_FIGMA_FOLDER}/{type}-{id}.json`
    },
    {
      id: 'jira-markdown',
      label: 'Jira markdown',
      description: 'Markdown copy of the Jira ticket read for a task item.',
      value: `${PROJECT_FOLDER}/{type}/{id}/${JIRA_MARKDOWN_FILE_NAME}`,
      defaultValue: `${PROJECT_FOLDER}/{type}/{id}/${JIRA_MARKDOWN_FILE_NAME}`
    }
  ];
}
