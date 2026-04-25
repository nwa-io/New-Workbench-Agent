export interface AgentConfig {
    tool: ToolType;
    folder: string;
    departments: string[];
    agents: string[];
    stack?: string[];
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}
  
export type ToolType = 'cursor' | 'claude-code' | 'copilot' | 'aider' | 'universal';
  
export interface Tool {
    id: ToolType;
    name: string;
    description: string;
    folder: string;
}
  
export const TOOLS: Record<ToolType, Tool> = {
    'cursor': {
      id: 'cursor',
      name: 'Cursor',
      description: '@-mentions and multi-file support',
      folder: '.cursorrules'
    },
    'claude-code': {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Native sub-agent support',
      folder: '.claude/agents'
    },
    'copilot': {
      id: 'copilot',
      name: 'GitHub Copilot',
      description: 'copilot-instructions.md',
      folder: '.github'
    },
    'aider': {
      id: 'aider',
      name: 'Aider',
      description: 'conventions.md',
      folder: '.aider'
    },
    'universal': {
      id: 'universal',
      name: 'Universal',
      description: 'Works with any tool',
      folder: '.ai'
    }
};
