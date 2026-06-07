import { getVsCodeApi } from '../shared/vscodeApi';
import type { ClaudeResourceWebviewMessage } from '../../protocol';

const vscode = getVsCodeApi();

/** Send a typed message up to the extension host. */
export function post(message: ClaudeResourceWebviewMessage): void {
  vscode.postMessage(message);
}
