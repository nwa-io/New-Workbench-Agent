import { getVsCodeApi } from '../shared/vscodeApi';
import type { AgentManagerWebviewMessage } from '../../protocol';

const vscode = getVsCodeApi();

/** Send a typed message up to the extension host. */
export function post(message: AgentManagerWebviewMessage): void {
  vscode.postMessage(message);
}
