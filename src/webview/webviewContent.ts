import { styles } from './templates/styles';
import { layout } from './templates/layout';
import { getScriptContent } from './templates/scriptTemplate';

/**
 * Generates the complete HTML content for the AgentKit webview.
 * This function assembles the webview from modular components:
 * - CSS styles from templates/styles.ts
 * - HTML layout from templates/layout.ts
 * - JavaScript logic from templates/scriptTemplate.ts
 */
export function getWebviewContent(): string {
  const script = getScriptContent();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentKit Manager</title>
  <style>
${styles}
  </style>
</head>
<body>
${layout}
${script}
</body>
</html>`;
}
