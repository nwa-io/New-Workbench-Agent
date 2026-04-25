declare module '@patricio0312rev/agentkit/src/lib/generator' {
    export interface GenerateConfig {
      tool: string;
      folder: string;
      departments: string[];
      agents: string[];
      stack?: string[];
    }
  
    export function generateAgents(config: GenerateConfig): Promise<any>;
}
  
declare module '@patricio0312rev/agentkit/src/lib/config' {
    export interface Department {
      name: string;
      description: string;
      agents: string[];
    }
  
    export interface Tool {
      name: string;
      description: string;
      folder: string;
    }
  
    export const DEPARTMENTS: Record<string, Department>;
    export const TOOLS: Record<string, Tool>;
}