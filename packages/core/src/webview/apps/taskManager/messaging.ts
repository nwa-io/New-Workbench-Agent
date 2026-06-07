import { getVsCodeApi } from '../shared/vscodeApi';
import type { TaskManagerWebviewMessage } from '../../protocol';

const vscode = getVsCodeApi();

/** Send a typed message up to the extension host. */
export function post(message: TaskManagerWebviewMessage): void {
  vscode.postMessage(message);
}
