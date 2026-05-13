import * as vscode from 'vscode';
import { CommandDependencies, ExtensionCommand } from './types';

export abstract class BaseCommand implements ExtensionCommand {
  protected constructor(
    public readonly id: string,
    protected readonly dependencies: CommandDependencies
  ) {}

  register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.id, (...args: unknown[]) => this.execute(...args));
  }

  abstract execute(...args: unknown[]): Promise<void> | void;
}
