import { WorkflowSettingsPanel } from '../../features/workflows/WorkflowSettingsPanel';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenWorkflowsCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.OPEN_WORKFLOWS, dependencies);
  }

  execute(): void {
    logger.info('Opening Workflows');
    WorkflowSettingsPanel.createOrShow(
      'workflows',
      this.dependencies.context.extensionUri,
      this.dependencies.configService
    );
  }
}
