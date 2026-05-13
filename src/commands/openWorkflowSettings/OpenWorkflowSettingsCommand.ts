import { WorkflowSettingsPanel } from '../../features/workflows/WorkflowSettingsPanel';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenWorkflowSettingsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.OPEN_WORKFLOW_SETTINGS, dependencies);
  }

  execute(): void {
    logger.info('Opening Workflow Settings');
    WorkflowSettingsPanel.createOrShow(this.dependencies.context.secrets, this.dependencies.configService);
  }
}
