import { AgentKitPanel } from '../../webview/AgentKitPanel';
import { COMMANDS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { BaseCommand } from '../BaseCommand';
import { CommandDependencies } from '../types';

export class OpenPanelCommand extends BaseCommand {
  constructor(dependencies: CommandDependencies) {
    super(COMMANDS.OPEN_PANEL, dependencies);
  }

  execute(): void {
    logger.info('Opening AgentKit panel');
    AgentKitPanel.createOrShow(this.dependencies.context.extensionUri, this.dependencies.configService);
  }
}
