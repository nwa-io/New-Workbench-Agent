# New Workbench Agent — Monorepo Architecture

This repository is an **npm-workspaces monorepo**. The VS Code extension is one
package (`core`); each workflow step is its own package; the Figma plugin is its
own package. The goal: changing a workflow step's strategy (how it collects Jira,
Figma, documents, etc.) should not require touching `core`.

## Packages

| Package | Name | Responsibility |
| --- | --- | --- |
| `packages/core` | `new-workbench-agent-vscode` | The VS Code extension: activation, commands, settings, Task Manager shell + webview, init-context, memory, obsidian graph, component browser, MCP server, and the **StepRegistry**. Holds the `contributes` manifest and is the published extension. |
| `packages/workflow-sdk` | `@nwa/workflow-sdk` | Pure contracts/types — no runtime `vscode` dependency. Workflow + task types and the `StepPlugin` / `StepContext` / `TaskKernel` interfaces. |
| `packages/task-kernel` | `@nwa/task-kernel` | Shared runtime infrastructure used by core and step packages (currently `logger`, `FileSystemService`; grows as step backends migrate). |
| `packages/step-collect-jira` | `@nwa/step-collect-jira` | Collect Jira step: detail UI + `JiraScraper` (Playwright + DOM scraping). |
| `packages/step-collect-figma` | `@nwa/step-collect-figma` | Collect Figma step: detail UI + `FigmaClient` (REST API + node tree). |
| `packages/step-collect-document` | `@nwa/step-collect-document` | Collect Document step: detail UI + judgment **strategy** (`buildDocumentJudgmentPrompt`, `parseDocumentJudgmentReport`). The markitdown conversion + Claude run **orchestration** stays in core — see "Remaining work". |
| `packages/step-automation-test` | `@nwa/step-automation-test` | Scaffold (skip on execute). |
| `packages/step-unit-test` | `@nwa/step-unit-test` | Scaffold (skip on execute). |
| `packages/step-auto-commit` | `@nwa/step-auto-commit` | Scaffold (skip on execute). |
| `packages/step-review-human` | `@nwa/step-review-human` | Scaffold (pauses workflow; manual completion). |
| `packages/spec-generator` | `@nwa/spec-generator` | Spec/markdown brief generation **strategy** (`buildSpecMarkdown` + `formatTaskMarkdown*Items`). A strategy library, **not** a `StepPlugin` (markdown generation is a Task Manager feature, not a workflow step). Core gathers inputs and delegates the template-filling here. |
| `packages/figma-plugin` | `figma-to-vscode-plugin` | The Figma plugin; builds standalone with its own `esbuild`/`tsconfig`. |

### Conventions

- **Internal packages are source-only**: their `package.json` `main`/`types`
  point at `src/index.ts`. esbuild bundles the TypeScript directly through the
  workspace symlink; `core`'s `tsc` typechecks them transitively. There is **no
  per-package build step**.
- `vscode`, `playwright`, and `playwright-core` are esbuild **externals** —
  provided at runtime, never bundled.
- Step packages depend on `@nwa/workflow-sdk` (contracts) and, when they need
  shared runtime, `@nwa/task-kernel`. They never import `core`.

## The step-plugin contract (`@nwa/workflow-sdk`)

A `StepPlugin` bundles a workflow step's three concerns:

```ts
interface StepPlugin {
  stepType: WorkflowStepType;          // e.g. 'collect_jira'
  detailNodeId: TaskNodeId;            // which detail panel it opens
  label: string;
  execute(step, ctx): Promise<StepExecutionResult | void>;   // backend
  messageHandlers?: Record<string, (data, ctx) => Promise<void>>;  // webview msgs it owns
  ui?: { detailScript: string; clientCommands?: string[] };  // client-side detail UI
}
```

### Registry (`packages/core/src/steps`)

- `plugins.ts` lists every bundled step with a **static import** (so esbuild
  includes it).
- `registry.ts` (`StepRegistry`, exported as `stepRegistry`) indexes plugins by
  `stepType` and `detailNodeId` and exposes `allDetailScripts()` /
  `allMessageHandlers()`.

### Webview UI contribution

`packages/core/src/webview/templates/taskScriptTemplate.ts` concatenates
`stepRegistry.allDetailScripts()` into the single-global-scope webview script,
alongside the shell scripts. A step's `ui.detailScript` defines the global
render functions (`renderJiraDetail`, `renderFigmaDetail`, …) that the shell's
detail view calls by name, and reads shell-owned globals (`taskState`,
`escapeHtml`, `statusClass`, the per-step form-state objects, etc.).

> The webview is one global scope. A step's `detailScript` must keep its global
> names collision-free (today they are unique per step).

## Adding / changing a workflow step

1. Create `packages/step-<name>/` (copy an existing step's `package.json` +
   `tsconfig.json`).
2. Implement a `StepPlugin` in `src/index.ts`. Put the strategy engine in its own
   module (mirror `JiraScraper` / `FigmaClient`) and the detail UI in `src/ui.ts`.
3. Add the package to the root `workspaces` array and to `core`'s `dependencies`.
4. Register the plugin in `packages/core/src/steps/plugins.ts`.
5. `npm install` (links the workspace), then `npm run build` + `npm run compile`.

To change how an already-extracted step works (Jira, Figma), edit only that
package — `core` does not change.

## Build / verify

```
npm install            # links all workspaces
npm run build          # esbuild bundle -> packages/core/dist/extension.js
npm run compile        # tsc -p packages/core (typechecks core + all internal pkgs)
npm test               # jest (core/src/test)
npm run build:figma    # builds the Figma plugin
```

## Remaining work (orchestration extraction — a focused future pass)

Jira and Figma are fully decoupled (UI **and** strategy engine live in their
package; `core` delegates). The **changeable strategy** of the document and spec
backends has also been extracted: the Claude judgment prompt + report parsing
(`@nwa/step-collect-document`) and the markdown brief template + formatters
(`@nwa/spec-generator`) are pure functions `core` delegates to.

What remains in `core` is the **orchestration** around those strategies, because
it is entangled with shared task state and infrastructure:

- **`collect_document`** — `judgeTaskDocumentsWithClaude` still owns markitdown
  conversion, bundled-guide reading (`extensionUri`), the VS Code terminal, and
  CLI-candidate resolution shared with other code paths; it now calls
  `buildDocumentJudgmentPrompt` / `parseDocumentJudgmentReport` for the strategy.
- **spec generation** — `generateTaskMarkdown` still gathers inputs (document
  summaries, Jira/Figma state via `getState`), reads the guide, appends memory
  context, compresses, and writes; it now calls `buildSpecMarkdown` for the
  template.

Moving that orchestration out is one deliberate refactor, not a quick patch,
because of two design decisions surfaced during the split:

1. **`StepContext` differs by entry point.** Workflow **execution** (the
   `TaskWorkflowExecutionService` executor) has no webview to `post` to; the
   **panel** message-handler path does. The context passed to `execute` vs
   `messageHandlers` should reflect that (e.g. `post`/`output` optional on the
   execution path), rather than forcing one shape.
2. **Cross-cutting state lives in `getState`.** `TaskManagerService.getState`
   aggregates each step's slice (`jira`, `figma`, documents) by reading item
   folders. For a step backend to own its persistence, either the kernel must
   expose item-folder/guide/terminal primitives behind `TaskKernel` **and** own
   the on-disk formats `getState` reads, or `getState` must delegate per-step
   state loading to the registry. Pick one before moving `collect_document`.

Suggested sequence for that pass:

1. Expand `@nwa/task-kernel` with item-folder + bundled-guide + terminal +
   CLI-candidate primitives; implement a concrete `TaskKernel` adapter in `core`.
2. Resolve decision (2) above (kernel-owns-persistence vs registry-loads-state).
3. Move the `collect_document` and spec-generation **orchestration** into their
   packages using the kernel (the strategy already lives there); route the
   executor and the panel's per-step messages through `stepRegistry`.
4. Shrink `TaskManagerService` to the kernel surface; delete the now-dead
   per-step branches.

## History

The monorepo was introduced incrementally (`git log` for the phased commits):
workspace scaffold → SDK + kernel + registry → collect-jira (proof slice) →
collect-figma → collect-document UI → stub steps → document-judgment &
spec-generation strategy. Each phase was committed independently and left the
build/compile/tests green.
