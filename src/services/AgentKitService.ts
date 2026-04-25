import { AgentConfig } from '../models/AgentConfig';
import { logger } from '../utils/logger';
const agentkit = require('@patricio0312rev/agentkit');

export class AgentKitService {
  async generateAgents(config: AgentConfig, workspaceRoot: string): Promise<void> {
    logger.info('Generating agents with config:', config);

    try {
      // Change to workspace directory
      const originalCwd = process.cwd();
      process.chdir(workspaceRoot);

      try {
        // Use agentkit package directly - it handles subfolder routing correctly
        await agentkit.generate(config);
        logger.info('Agents generated successfully');
      } finally {
        process.chdir(originalCwd);
      }
    } catch (error) {
      logger.error('Error generating agents', error as Error);
      throw error;
    }
  }

  async getDepartments(): Promise<Record<string, any>> {
    return agentkit.getDepartments();
  }

  async getAvailableAgents(): Promise<any[]> {
    const departments = agentkit.getDepartments();
    const agents: Array<{ id: string; name: string; department: string; departmentName: string }> = [];

    Object.entries(departments).forEach(([deptId, dept]: [string, any]) => {
      dept.agents.forEach((agentName: string) => {
        agents.push({
          id: `${deptId}/${agentName}`,
          name: agentName,
          department: deptId,
          departmentName: dept.name
        });
      });
    });

    return agents;
  }
}
