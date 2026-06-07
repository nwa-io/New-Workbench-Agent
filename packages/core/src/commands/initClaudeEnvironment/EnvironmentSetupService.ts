import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { openExternalTerminal } from '../../utils/externalTerminal';
import { createPlatformInstallScript } from './platforms/installScriptFactory';
import { InstallStatus } from './types';

export class EnvironmentSetupService {
  async run(): Promise<void> {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentkit-init-env-'));
    const statusPath = path.join(tempDirectory, 'status.json');
    const scriptPath = await createPlatformInstallScript(process.platform, tempDirectory, statusPath);

    await openExternalTerminal(scriptPath);

    const status = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'NWA: Waiting for Init env terminal',
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: 'Checking and installing missing dependencies in external terminal' });
        return this.waitForInstallStatus(statusPath, token);
      }
    );

    if (status.status !== 'success') {
      throw new Error(status.message || 'Init env installation failed');
    }
  }

  private async waitForInstallStatus(
    statusPath: string,
    token?: vscode.CancellationToken
  ): Promise<InstallStatus> {
    const startedAt = Date.now();
    const timeoutMs = 30 * 60 * 1000;

    while (Date.now() - startedAt < timeoutMs) {
      if (token?.isCancellationRequested) {
        throw new Error('Init env was cancelled');
      }

      const status = await this.readInstallStatus(statusPath);
      if (status) {
        return status;
      }

      await this.delay(1000);
    }

    throw new Error('Timed out waiting for Init env terminal to finish');
  }

  private async readInstallStatus(statusPath: string): Promise<InstallStatus | undefined> {
    try {
      const content = await fs.readFile(statusPath, 'utf8');
      const status = JSON.parse(this.stripJsonBom(content).trim()) as InstallStatus;

      if (status.status === 'success' || status.status === 'failed') {
        return status;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private stripJsonBom(content: string): string {
    return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
