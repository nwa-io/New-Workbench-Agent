# Figma to VS Code Sender

MVP Figma plugin that scans the currently selected Figma node and ships its
design spec to a local VS Code extension via WebSocket
(default `ws://localhost:8080`).

This plugin is intentionally **export-only**: it does not generate source
code. The VS Code extension is responsible for mapping the spec to existing
components/tokens and producing production code.

## Architecture

```
Figma plugin (code.ts)  -- figma.ui.postMessage -->  Plugin UI (ui.ts)
                                                          |
                                                          | WebSocket (browser API)
                                                          v
                                            VS Code extension @ ws://localhost:8080
```

`code.ts` runs in the Figma plugin sandbox and reads the document with the
Figma Plugin API. `ui.ts` runs in the iframe where the browser `WebSocket`
API is available, so all network I/O happens there.

## Install

```bash
cd figma-to-vscode-plugin
npm install
```

## Build

```bash
npm run build      # one-shot build
npm run watch      # rebuild on file change
```

Outputs to `dist/`:

- `dist/code.js` — plugin main runtime
- `dist/ui.html` — UI document with `ui.js` inlined

## Import into Figma

1. Open **Figma Desktop**.
2. Menu: **Plugins → Development → Import plugin from manifest…**
3. Pick `figma-to-vscode-plugin/manifest.json`.
4. Run from **Plugins → Development → Figma to VS Code Sender**.

## Use

1. Select a `FRAME`, `COMPONENT`, `INSTANCE`, `SECTION`, or `GROUP`.
2. Open the plugin. The **Scan & Send to VS Code** button enables once a
   supported node is selected (it stays disabled otherwise).
3. Confirm/edit the WebSocket URL (default `ws://localhost:8080`).
4. Click **Scan & Send to VS Code**.
5. Watch the status box for success or a helpful connection error.

## Payload shape

The UI sends an envelope over the socket:

```json
{
  "type": "FIGMA_DESIGN_SPEC",
  "sentAt": "2026-05-18T12:34:56.000Z",
  "payload": {
    "type": "FIGMA_DESIGN_SPEC",
    "version": "0.1.0",
    "source": "figma-plugin",
    "createdAt": "...",
    "file":      { "name": "...", "pageName": "..." },
    "selection": { "id": "...", "name": "...", "type": "FRAME", "children": [ ... ] },
    "variables": [ ... ]
  }
}
```

Each serialized node may include: basic geometry, `layout` (auto-layout),
`style` (fills/strokes/effects/corner radius), `text` (for `TEXT` nodes),
`instance` (with `mainComponent`, `componentProperties`, `variantProperties`
for `INSTANCE` nodes), `component`/`componentSet` metadata, and recursive
`children`.

Mixed values are stringified as `"mixed"`. Unsupported properties are
silently skipped instead of throwing.

## Test with a quick WebSocket server

A minimal Node receiver to verify end-to-end flow:

```js
// scratch-receiver.js
const { WebSocketServer } = require("ws"); // npm i ws
const wss = new WebSocketServer({ port: 8080 });
wss.on("connection", (sock) => {
  sock.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log("got", msg.type, "payload bytes:", data.length);
    console.log(JSON.stringify(msg.payload.selection, null, 2).slice(0, 800));
  });
});
console.log("listening on ws://localhost:8080");
```

Run `node scratch-receiver.js`, then click **Scan & Send to VS Code** in the
plugin.

## Notes for the VS Code extension side

- Listen on the same port (`8080` by default).
- Treat the `payload` as immutable input.
- Resolve `selection.children[].instance.mainComponent.key` against your own
  component map to produce code; do not rely on Figma node ids being stable
  across files.
- Use `payload.variables` to resolve design tokens; fall back to raw style
  values when no variable mapping exists.
