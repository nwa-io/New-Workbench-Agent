import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('AgentKit');
  }

  info(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] INFO: ${message}`);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  error(message: string, error?: Error): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
    if (error) {
      this.outputChannel.appendLine(error.stack || error.message);
    }
    this.outputChannel.show();
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] WARN: ${message}`);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  debug(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] DEBUG: ${message}`);
    if (args.length > 0) {
      this.outputChannel.appendLine(JSON.stringify(args, null, 2));
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

export const logger = new Logger();