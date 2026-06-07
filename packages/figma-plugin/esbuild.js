// esbuild.js
// Bundles the Figma plugin: builds the main runtime (code.ts) and the UI script (ui.ts),
// then inlines the UI bundle into ui.html so Figma can load it as a single document.

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatch = process.argv.includes("--watch");

const distDir = path.resolve(__dirname, "dist");
const srcDir = path.resolve(__dirname, "src");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const codeBuildOptions = {
  entryPoints: [path.join(srcDir, "code.ts")],
  bundle: true,
  outfile: path.join(distDir, "code.js"),
  platform: "browser",
  target: "es2017",
  format: "iife",
  logLevel: "info",
};

const uiBuildOptions = {
  entryPoints: [path.join(srcDir, "ui.ts")],
  bundle: true,
  // Write to a temp file inside dist so we can inline it into ui.html.
  outfile: path.join(distDir, "ui.js"),
  platform: "browser",
  target: "es2017",
  format: "iife",
  logLevel: "info",
};

function inlineUiHtml() {
  const htmlSrcPath = path.join(srcDir, "ui.html");
  const jsBundlePath = path.join(distDir, "ui.js");
  const htmlOutPath = path.join(distDir, "ui.html");

  if (!fs.existsSync(htmlSrcPath)) {
    throw new Error("Missing src/ui.html");
  }
  if (!fs.existsSync(jsBundlePath)) {
    throw new Error("Missing dist/ui.js — UI bundle did not build");
  }

  const html = fs.readFileSync(htmlSrcPath, "utf8");
  const js = fs.readFileSync(jsBundlePath, "utf8");

  // Replace the placeholder script tag with an inline <script> containing the bundled JS.
  // The src/ui.html includes: <script src="ui.js"></script>
  const inlined = html.replace(
    /<script\s+src=["']ui\.js["']\s*><\/script>/i,
    `<script>${js}</script>`
  );

  fs.writeFileSync(htmlOutPath, inlined, "utf8");
  console.log("[esbuild] wrote", path.relative(__dirname, htmlOutPath));
}

async function buildOnce() {
  await esbuild.build(codeBuildOptions);
  await esbuild.build(uiBuildOptions);
  inlineUiHtml();
}

async function watch() {
  const codeCtx = await esbuild.context({
    ...codeBuildOptions,
    plugins: [
      {
        name: "log-rebuild",
        setup(build) {
          build.onEnd(() => console.log("[esbuild] code.ts rebuilt"));
        },
      },
    ],
  });

  const uiCtx = await esbuild.context({
    ...uiBuildOptions,
    plugins: [
      {
        name: "ui-inline",
        setup(build) {
          build.onEnd(() => {
            try {
              inlineUiHtml();
            } catch (err) {
              console.error("[esbuild] failed to inline ui.html:", err);
            }
          });
        },
      },
    ],
  });

  await codeCtx.watch();
  await uiCtx.watch();
  console.log("[esbuild] watching for changes...");
}

(async () => {
  try {
    if (isWatch) {
      await watch();
    } else {
      await buildOnce();
      console.log("[esbuild] build complete");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
