const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Plugin to copy static assets into dist/
const copyTemplatesPlugin = {
  name: 'nw-templates',
  setup(build) {
    build.onEnd(() => {
      const distDir = path.join(__dirname, 'dist');

      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      const srcExecution = path.join(__dirname, 'src/webview/execution');
      const destExecution = path.join(distDir, 'execution');

      if (fs.existsSync(srcExecution)) {
        if (fs.existsSync(destExecution)) {
          fs.rmSync(destExecution, { recursive: true });
        }
        fs.cpSync(srcExecution, destExecution, { recursive: true });
        console.log('Copied Claude resource templates');
      } else {
        console.warn('Claude resource templates directory not found:', srcExecution);
      }
    });
  }
};

// Node-target bundle for the extension host + MCP server.
function createExtensionContext() {
  return esbuild.context({
    entryPoints: ['src/extension.ts', 'src/mcp/server.ts'],
    bundle: true,
    outbase: 'src',
    outdir: 'dist',
    external: ['vscode', 'playwright', 'playwright-core'],
    format: 'cjs',
    platform: 'node',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
    plugins: [copyTemplatesPlugin],
  });
}

// Browser-target bundles for the React webview apps. Each entry produces
// dist/webview/<name>.js (+ .css) loaded by the matching panel via a CSP nonce.
function createWebviewContext() {
  return esbuild.context({
    entryPoints: {
      claudeResource: 'src/webview/apps/claudeResource/main.tsx',
      workflowSettings: 'src/webview/apps/workflowSettings/main.tsx',
      agentManager: 'src/webview/apps/agentManager/main.tsx',
      taskManager: 'src/webview/apps/taskManager/main.tsx',
    },
    bundle: true,
    outdir: 'dist/webview',
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    loader: { '.ts': 'ts', '.tsx': 'tsx' },
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
  });
}

async function main() {
  const contexts = await Promise.all([
    createExtensionContext(),
    createWebviewContext(),
  ]);

  if (watch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(contexts.map(ctx => ctx.rebuild()));
    await Promise.all(contexts.map(ctx => ctx.dispose()));
    console.log('Build complete!');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
