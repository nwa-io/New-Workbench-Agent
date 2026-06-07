import { getVsCodeApi } from '../shared/vscodeApi';
import type { WorkflowSettingsWebviewMessage } from '../../protocol';

const vscode = getVsCodeApi();

/** Send a typed message up to the extension host. */
export function post(message: WorkflowSettingsWebviewMessage): void {
  vscode.postMessage(message);
}
