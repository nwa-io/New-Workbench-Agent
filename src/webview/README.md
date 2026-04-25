# Webview Architecture

This directory contains the AgentKit webview implementation, refactored into a modular structure for better maintainability.

## Directory Structure

```
src/webview/
├── AgentKitPanel.ts              # Main webview panel manager (handles VS Code integration)
├── webviewContent.ts             # Assembles the complete HTML (40 lines)
├── data/                         # Constants and configuration data
│   ├── agentDescriptions.ts      # Agent descriptions (50 lines)
│   ├── departments.ts            # Department icons (9 lines)
│   ├── models.ts                 # Claude model definitions (12 lines)
│   └── tools.ts                  # Tool definitions (15 lines)
└── templates/                    # HTML, CSS, and JavaScript templates
    ├── layout.html               # HTML structure (83 lines) - source file
    ├── layout.ts                 # HTML as TypeScript export (bundled)
    ├── scriptTemplate.ts         # JavaScript logic (313 lines)
    ├── styles.css                # CSS styles (391 lines) - source file
    └── styles.ts                 # CSS as TypeScript export (bundled)
```

## File Breakdown

### Main Files

#### `webviewContent.ts` (30 lines)
The main assembler that imports all components and generates the final HTML document.
- Imports CSS string from `templates/styles.ts`
- Imports HTML string from `templates/layout.ts`
- Gets script content from `templates/scriptTemplate.ts`
- Assembles everything into a complete HTML document at compile time

#### `AgentKitPanel.ts` (existing)
VS Code webview panel manager that handles:
- Creating and managing the webview
- Message passing between webview and extension
- Install/cancel actions

### Data Files (Constants)

#### `data/tools.ts` (15 lines)
Tool definitions including:
- Cursor, Claude Code, GitHub Copilot, Aider, Universal
- Each tool has: id, name, icon, description, default folder

#### `data/models.ts` (12 lines)
Claude model definitions for Claude Code:
- Sonnet (default), Opus, Haiku, Inherit from parent
- Each model has: id, name, description

#### `data/departments.ts` (9 lines)
Department icon mappings:
- Maps department IDs to emoji icons
- Design 🎨, Engineering ⚙️, Marketing 📢, etc.

#### `data/agentDescriptions.ts` (50 lines)
Agent descriptions for all 35+ agents across departments

### Template Files

#### `templates/styles.css` (391 lines)
All CSS styles for the webview:
- Layout and typography
- Tool, model, and department card styles
- Selected badge animations
- Summary and button styles

#### `templates/layout.html` (83 lines)
HTML structure including:
- Step 1: Select AI Tool
- Step 2: Select Model (Claude Code only)
- Step 3: Select Departments
- Step 4: Select Agents
- Step 5: Custom Folder (optional)
- Summary section
- Action buttons

#### `templates/scriptTemplate.ts` (313 lines)
All JavaScript logic:
- Tool/model/department selection
- Agent list rendering
- Summary updates
- Message passing to VS Code
- Event handlers

## Benefits of This Structure

### Before Refactoring
- Single file: `webviewContent.ts` (878 lines)
- Hard to navigate and maintain
- Mixing concerns (HTML, CSS, JS, data)

### After Refactoring
- Largest file: `styles.css` (391 lines)
- Clear separation of concerns
- Easy to find and modify specific parts
- Type-safe constants in TypeScript
- Reusable components

## Making Changes

### To update styles
1. Edit `templates/styles.css`
2. Run the conversion script:
   ```bash
   node -e "const fs=require('fs');const c=fs.readFileSync('src/webview/templates/styles.css','utf8');fs.writeFileSync('src/webview/templates/styles.ts','export const styles = \`'+c.replace(/\`/g,'\\\`').replace(/\$/g,'\\\$')+'\`;\n');"
   ```
3. Or manually update `templates/styles.ts`

### To update layout
1. Edit `templates/layout.html`
2. Run the conversion script:
   ```bash
   node -e "const fs=require('fs');const c=fs.readFileSync('src/webview/templates/layout.html','utf8');fs.writeFileSync('src/webview/templates/layout.ts','export const layout = \`'+c.replace(/\`/g,'\\\`').replace(/\$/g,'\\\$')+'\`;\n');"
   ```
3. Or manually update `templates/layout.ts`

### To update JavaScript logic
Edit `templates/scriptTemplate.ts`

### To add/modify tools, models, or agents
Edit files in `data/` directory

### After making changes
Run `npm run compile` to check TypeScript, then `npm run build` to bundle.

### Why .css/.html and .ts files?
- `.css` and `.html` files are easier to edit with proper syntax highlighting
- `.ts` files are what actually get bundled and used at runtime
- After editing `.css` or `.html`, run the conversion script to update `.ts` files
- Alternatively, edit `.ts` files directly if you prefer

## Notes

- The webview uses ES modules for importing Simple Icons
- All data is serialized to JSON when injected into the script
- The script runs in an isolated webview context (no direct file access)
- VS Code webviews have a Content Security Policy for security
