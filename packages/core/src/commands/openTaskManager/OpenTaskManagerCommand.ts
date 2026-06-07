import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { TaskManagerPanel } from '../../webview/TaskManagerPanel';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenTaskManagerCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.OPEN_TASK_MANAGER, dependencies);
  }

  execute(): void {
    logger.info('Opening Task Manager');
    TaskManagerPanel.createOrShow(
      this.dependencies.context.extensionUri,
      this.dependencies.configService,
      'task',
      this.dependencies.context.globalStorageUri
    );
  }
}
