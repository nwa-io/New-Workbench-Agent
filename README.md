<p align="center"><img src="nwa-agent.png" alt="" width="300px" height="auto"></p>

<div align="center">
<br />

![Last Update](https://img.shields.io/github/last-commit/b0yblake/New-Workbench-Agent?label=Last%20Update&style=flat-square)
[![VScode](https://img.shields.io/badge/Visual%20Studio%20Code-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-5FA04E?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Follow on X](https://img.shields.io/badge/Follow%20on-X-000000?style=flat-square&logo=x)](https://x.com/lichhuuhuu)

<h3>The Human-Controlled AI for Developers</h3>
<p><b>Two cores, one workbench:</b> a visual <b>Workflow</b> builder and a real agent <b>Harness</b> — right inside VS Code.</p>
<sub>AI agent harness · agent workflow builder · human-in-the-loop · context engineering · Claude Code · Cursor · Copilot · Aider</sub>

</div>

> **Not just another fancy agents tool.**
> NWA Agent is a human-controlled AI that gives developers full control over how multiple agents **think, work, adapt, and deliver** — in VS code. It is built to *amplify* developers, not replace them.

---

## 🧩 Workflow is not enough. Meet the Harness.

Everyone is shipping "workflows." A workflow is the **plan** — it says *what* the agents do and in *what order*. That's necessary. But run on its own, a workflow is a black box: it starts, it runs, and you hope for the best.

The thing that actually decides whether an agent succeeds isn't the plan. It's the **harness** — the scaffolding *around* the model:

- 👀 **what the agent sees** (context delivery)
- 🛠️ **what it can touch** (tools, permissions, sandboxes)
- ✋ **when it must stop and ask you** (verification & human-in-the-loop)
- 🧠 **what it remembers** (project memory & state)
- 🔁 **what happens when things go wrong** (feedback loops & recovery)

> 💡 **The models are converging.** When everyone has access to the same frontier models, "which model?" stops being the moat. *How good is your harness?* becomes the real competitive advantage — the same model can go from ~60% to ~98% task success depending entirely on the harness around it.

**NWA Agent gives you both, as first-class citizens:**

```
        WHAT to do, in what order            HOW it actually runs, safely
        ┌───────────────────────┐            ┌───────────────────────────┐
        │       WORKFLOW        │     ×      │          HARNESS          │
        │  steps · parallel ·   │  ───────►  │  context · tools · memory │
        │  per-step models      │            │  human-in-the-loop · state│
        └───────────────────────┘            └───────────────────────────┘
                              \                /
                               ▼   reliable   ▼
                          AI that ships real work
```

---

## ✨ Why this repo exists

> Read each row left-to-right: a real pain → the **plan** that addresses it → the **control** that makes the plan actually land → the payoff you feel.

| Pain Point | The Workflow plan | The Harness control | What you actually get |
|---|---|---|---|
| 🤖 **Shallow "agent" tools** that live outside your editor and break the moment real code is involved | A visual pipeline of concrete steps — *collect → generate → test → review* — modeled on how you really ship | Runs **natively in VS Code** against your real workspace files, terminal, and Git — no copy-paste bridge | AI that works *in your repo*, not in a sandbox demo — the output is the change, ready to review. |
| 🏃 **Black-box runs** that sprint start-to-finish and only show you the wreckage afterward | Steps are **observable units** — you watch each one start, progress, and finish, with live status and token cost | **Human-in-the-loop review gates** halt the run and hand control back to you before the next step commits anything | Catch a wrong turn at step 2 instead of debugging the whole run at step 9 — you approve, then it continues. |
| 🔁 **No steering wheel mid-run** — your only options are "let it finish" or "kill it and restart" | Steps stay **editable while idle** — reorder, re-scope, or swap a step's role between runs | **Mid-flow intervention**: pause at a gate, rewrite the brief or context, then resume *from there* — earlier work is kept | Change direction without throwing away the 20 minutes of context the agent already built. |
| 🧠 **Context chaos** — the agent either sees nothing useful or drowns in the whole repo | Each step carries its **own instructions and model**, so the right brain gets the right job | **Layered context delivery** (auto-loaded rules · on-demand docs · hot data) + **persistent project memory** that survives across runs | Agents start *informed* instead of from zero — fewer hallucinations, less re-explaining the same thing. |
| 🎯 **One-size model** wastes money on easy steps and underthinks the hard ones | **Per-step model + reasoning-speed** selection baked into the workflow | The harness routes each step to the chosen model/runtime and enforces it at execution | Spend deep reasoning where it matters, fast-and-cheap where it doesn't — cost and quality both go up. |
| 🔒 **Rigid, copy-pasted workflows** that silently drift apart and can't be reused | Workflows are **composable from `@nwa/step-*` packages** on a shared SDK, and import/export across projects | Each step is an isolated, core-free package with a single `execute` entry — change one without breaking the rest | Build a workflow once, reuse and version it everywhere — your team's process becomes a real artifact. |
| ⚙️ **Speed vs. control is a false trade-off** most tools force on you | Multi-agent + **parallel groups** run independent work concurrently | **Oversight & guardrails** — gates, memory, and per-step limits keep the speed from running off a cliff | Frontier-model speed *with* your judgment in the loop — fast **and** trustworthy, not one or the other. |

---

## 🪴 Quick demo

<img src="@README/demo.gif" alt="" width="100%" height="auto">

---

## 📦 Installation

The final installation path and package source will be updated before release.

### From VS Code Marketplace

1. Open VS Code.
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **"New Workbench Agent"**.
4. Click **Install**.

### From VSIX

Use the packaged extension path after it is published or built locally:

```bash
code --install-extension <path-to-new-workbench-agent.vsix>
```

### From Source

```bash
npm install
npm run build
```

Then press `F5` in VS Code to launch the Extension Development Host.

---

## 🚀 Quick Start

### 1. Open the Agent Manager

1. Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`.
2. Run **"NWA: Open Agent Manager"**.
3. Choose the AI tool you want to configure.
4. Select the departments and agents that match your workflow.
5. Click **Install Agents**.

### 2. Use a Quick Setup Preset

1. Open the Command Palette.
2. Run **"NWA: Quick Setup"**.
3. Select one of the available presets:
   - 🚀 **Full Stack Developer**
   - ⚡ **Rapid Prototyper**
   - 🎨 **Design-First**
   - 📈 **Growth-Focused**
   - 🏢 **Enterprise Team**

### 3. Build a Workflow + wire its Harness

1. Open the **NWA Workflows** view and create a workflow — add steps, parallel groups, and pick a model/speed per step.
2. Open the **NWA Task Manager** to run it, watch progress, and step in at human-in-the-loop review gates.
3. Use **Claude Resource Manager** to give each agent the right context (rules, docs, hot data).

### 4. Manage From the Sidebar

1. Open the **NWA** Activity Bar view.
2. Browse the **Tools**, **Task**, **Memory**, and **Component Browser** views.
3. Run **NWA: Open Agent Manager** or **NWA: Skills selection** when you need to install more resources.

---

## 📚 Claude Resource Manager

This is your **context harness**. Initialize Claude Code context resources by selecting files from each layer. You can select one file, several files, or every file, then use the floating **Install** action to create the selected resources in your workspace.

### Layer 1: Auto-loaded Rules
### Layer 2: On-demand Docs
### Layer 3: Hot Data

`SKILL.md` is installed to `.claude/skills/SKILL.md`. If a previous `SKILL.md` exists there, it is renamed to `SKILL.md-old` before the new file is created.

---

## ⚙️ Configuration

### Settings

Open VS Code Settings (`Ctrl+,` or `Cmd+,`) and search for **"NWA"**:

| Setting | Default | What it does |
|---|---|---|
| `nwa.defaultTool` | `cursor` | Default AI tool for agent configuration — `cursor`, `claude-code`, `copilot`, `aider`, or `universal`. |
| `nwa.defaultFolder` | `""` | Custom default folder name (empty = tool-specific defaults). |
| `nwa.autoRefresh` | `true` | Automatically refresh the agent list when files change. |
| `nwa.showWelcome` | `true` | Show the welcome message on first use. |
| `nwa.defaultDepartments` | `["engineering","design"]` | Pre-selected departments — `design`, `engineering`, `marketing`, `product`, `project-management`, `studio-operations`, `testing`. |
| `nwa.favoriteAgents` | `[]` | Starred agent IDs, managed through the UI. |
| `nwa.taskDocumentsFolder` | `.project/docs` | Workspace-relative folder where the **Task Manager** stores markdown documents (converted with markitdown). |
| `nwa.componentPaths` | `src/components`, `src/atoms`, … | Workspace-relative paths the **Component Browser** and Figma catalog scan for Vue / React / Angular / Svelte components. |

### Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

**Agents & setup**
- `NWA: Open Agent Manager` — open the visual agent manager.
- `NWA: Quick Setup` — install agents from a preset.
- `NWA: Initialize Agents` — run guided setup.
- `NWA: View Agent Details` — inspect an agent.

**Context & skills (the harness)**
- `Install Helpers` — set up the Claude Code environment.
- `NWA: Skills selection` — open the Claude Resource Manager to install context resources.

**Workflows & tasks**
- `NWA: Task` — open the Task Manager to run and track work.
- `NWA: Workflows` — open the visual workflow builder.
- `NWA: Workflow Settings` — configure workflow defaults.

**Memory**
- `NWA: Add Memory` — save a memory manually.
- `NWA: Search Memory` — search project memories.
- `NWA: Show All Memories` — list every stored memory.
- `NWA: Clear All Memories` — remove all memories.

**Component Browser**
- `NWA: Refresh Component Browser` — re-scan component paths.
- `NWA: Add Component Scan Path` / `NWA: Remove Component Scan Path` — manage scan paths.

**Figma MCP bridge**
- `NWA Agent: Start Figma MCP Bridge` / `Stop Figma MCP Bridge` / `Show Figma MCP Status`.

## 🐛 Troubleshooting

### Agents not working with Cursor

1. Restart Cursor after installing agents.
2. Make sure files exist in `.cursorrules/`.
3. Use `@` to mention agent files.

### Claude resources not appearing

1. Open **NWA: Skills selection**.
2. Select the resources you want to install.
3. Click the floating **Install** action.
4. Refresh the VS Code Explorer if needed.

### Extension not activating

1. Check your VS Code version. This extension requires `1.85.0` or newer.
2. Reload the window with `Ctrl+R` or `Cmd+R`.
3. Check the Output panel for errors.

---

## 🤝 Contributing

Found a bug or have a feature request?

- **Critical project discussions**: [GitHub Discussions](https://github.com/b0yblake/New-Workbench-Agent/discussions)
- 🐛 **Report bugs**: [GitHub Issues](https://github.com/b0yblake/New-Workbench-Agent/issues)
- 💡 **Suggest features**: [GitHub Discussions](https://github.com/b0yblake/New-Workbench-Agent/discussions)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/b0yblake/New-Workbench-Agent/wiki)

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](./LICENSE) file for details.

---

Made with love by [b0yblake](https://github.com/b0yblake)
