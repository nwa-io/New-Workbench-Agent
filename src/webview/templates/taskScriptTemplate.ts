import { TaskManagerMode } from '../../models/TaskManager';
import { getStateScript } from './scripts/state';
import { getHelpersScript } from './scripts/helpers';
import { getListViewScript } from './scripts/listView';
import { getCreateViewScript } from './scripts/createView';
import { getDetailViewScript } from './scripts/detailView';
import { getMarkdownDialogScript } from './scripts/markdownDialog';
import { getJiraDetailScript } from './scripts/jiraDetail';
import { getFigmaDetailScript } from './scripts/figmaDetail';
import { getDocumentDetailScript } from './scripts/documentDetail';
import { getMessageHandlerScript } from './scripts/messageHandler';

export function getTaskScriptContent(initialMode: TaskManagerMode): string {
  return `
    <script>
      const vscode = acquireVsCodeApi();
      const initialMode = ${JSON.stringify(initialMode)};

      ${getStateScript()}
      ${getHelpersScript()}
      ${getListViewScript()}
      ${getCreateViewScript()}
      ${getDetailViewScript()}
      ${getMarkdownDialogScript()}
      ${getJiraDetailScript()}
      ${getFigmaDetailScript()}
      ${getDocumentDetailScript()}
      ${getMessageHandlerScript()}
    </script>
  `;
}
