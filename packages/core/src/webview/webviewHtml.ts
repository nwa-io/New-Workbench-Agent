import * as vscode from 'vscode';

/** Cryptographically-unguessable nonce for the CSP `script-src`. */
export function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

interface WebviewHtmlOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  /** Bundle name under `dist/webview/`, e.g. `claudeResource`. Produces `<name>.js` (+ optional `<name>.css`). */
  bundle: string;
  title: string;
  /** Whether a sibling `<name>.css` exists for this bundle. */
  withStyles?: boolean;
  /** Optional JSON-serializable values exposed to the app as `window.__NWA_BOOTSTRAP__`. */
  bootstrap?: Record<string, unknown>;
}

/**
 * Builds the minimal HTML shell for a React webview app: a strict CSP, a single
 * `#root` mount node, and a nonce'd module script loaded from `dist/webview/`.
 * The panel that uses this MUST set `localResourceRoots` to include
 * `dist/webview` (see {@link webviewLocalResourceRoots}).
 */
export function renderWebviewHtml(options: WebviewHtmlOptions): string {
  const { webview, extensionUri, bundle, title, withStyles = true, bootstrap } = options;
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', `${bundle}.js`)
  );
  const styleUri = withStyles
    ? webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', `${bundle}.css`))
    : undefined;

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`
  ].join('; ');

  const styleTag = styleUri ? `\n  <link rel="stylesheet" href="${styleUri}">` : '';
  const bootstrapTag = bootstrap
    ? `\n  <script nonce="${nonce}">window.__NWA_BOOTSTRAP__=${JSON.stringify(bootstrap).replace(/</g, '\\u003c')};</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${title}</title>${styleTag}
</head>
<body>
  <div id="root"></div>${bootstrapTag}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/** The `localResourceRoots` entry required for {@link renderWebviewHtml} bundles. */
export function webviewLocalResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
  return [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')];
}
