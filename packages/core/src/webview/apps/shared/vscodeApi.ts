/**
 * Thin, typed wrapper around the `acquireVsCodeApi()` global available inside a
 * VS Code webview. `acquireVsCodeApi` may be called only once per page, so the
 * handle is memoized here and shared by every module in the bundle.
 */

export interface VsCodeApi<State = unknown> {
  postMessage(message: unknown): void;
  getState(): State | undefined;
  setState(state: State): void;
}

declare global {
  // Provided by the VS Code webview runtime.
  function acquireVsCodeApi<State = unknown>(): VsCodeApi<State>;
}

let cached: VsCodeApi | undefined;

export function getVsCodeApi<State = unknown>(): VsCodeApi<State> {
  if (!cached) {
    cached = acquireVsCodeApi();
  }
  return cached as VsCodeApi<State>;
}
