export interface Tool {
  id: string;
  name: string;
  icon: string;
  desc: string;
  folder: string;
}

export const tools: Tool[] = [
  { id: 'cursor', name: 'Cursor', icon: 'cursor', desc: '@-mentions and multi-file', folder: '.cursorrules' },
  { id: 'claude-code', name: 'Claude Code', icon: 'anthropic', desc: 'Native sub-agent support', folder: '.claude/agents' },
  { id: 'copilot', name: 'GitHub Copilot', icon: 'github', desc: 'copilot-instructions.md', folder: '.github' },
  { id: 'aider', name: 'Aider', icon: 'git', desc: 'conventions.md', folder: '.aider' },
  { id: 'universal', name: 'Universal', icon: 'openai', desc: 'Works with any tool', folder: '.ai' }
];
