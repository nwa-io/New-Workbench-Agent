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

      const srcObsidianGraphMedia = path.join(__dirname, 'src/features/obsidianGraph/webview/media');
      const destObsidianGraphMedia = path.join(distDir, 'obsidianGraph/media');

      if (fs.existsSync(srcObsidianGraphMedia)) {
        if (fs.existsSync(destObsidianGraphMedia)) {
          fs.rmSync(destObsidianGraphMedia, { recursive: true });
        }
        fs.cpSync(srcObsidianGraphMedia, destObsidianGraphMedia, { recursive: true });
        console.log('Copied Obsidian graph webview assets');
      } else {
        console.warn('Obsidian graph webview assets directory not found:', srcObsidianGraphMedia);
      }
    });
  }
};

async function main() {
  const ctx = await esbuild.context({
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

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('Build complete!');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
