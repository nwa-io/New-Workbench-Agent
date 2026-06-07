import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { openExternalTerminal } from '../../utils/externalTerminal';
import { buildAgentCommandPrefix } from '../workflows/modelInvocation';

export interface ClaudeCodeRunStoppedEvent {
  markdownPath: string;
  message: string;
}

export class ClaudeCodeTerminalService {
  private activeRunCleanup?: () => void;

  async open(
    workspaceFolder: vscode.Uri,
    markdownPath: string,
    itemId: string | undefined,
    onStopped: (event: ClaudeCodeRunStoppedEvent) => void,
    model?: string,
    speed?: string
  ): Promise<void> {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'agentkit-claude-run-'));
    const donePath = path.join(tempDir, 'done.flag');
    const scriptPath = await this.createRunScript(tempDir, donePath, workspaceFolder, markdownPath, itemId, model, speed);

    this.dispose();
    this.watchRunDone(donePath, tempDir, markdownPath, onStopped);

    try {
      await openExternalTerminal(scriptPath);
    } catch (error) {
      this.dispose();
      await this.deleteTempDir(tempDir);
      throw error;
    }
  }

  dispose(): void {
    this.activeRunCleanup?.();
    this.activeRunCleanup = undefined;
  }

  private async createRunScript(
    tempDir: string,
    donePath: string,
    workspaceFolder: vscode.Uri,
    markdownPath: string,
    itemId?: string,
    model?: string,
    speed?: string
  ): Promise<string> {
    const claudeCommand = this.getClaudeCodeCommand(markdownPath, model, speed);
    const cwd = workspaceFolder.fsPath.replace(/\\/g, '/');
    const bashDonePath = donePath.replace(/\\/g, '/');
    const title = itemId ? `NWA Claude Code: ${itemId}` : 'NWA Claude Code';

    const bashScript = `#!/usr/bin/env bash
      export PATH="$HOME/.local/bin:$PATH"
      cd "${cwd}"
      ${claudeCommand}
      status=$?
      : > "${bashDonePath}"
      exit $status
      `;

    const bashScriptPath = path.join(tempDir, 'run-claude.sh');
    await fsPromises.writeFile(bashScriptPath, bashScript, 'utf8');

    if (process.platform !== 'win32') {
      await fsPromises.chmod(bashScriptPath, 0o755);
      return bashScriptPath;
    }

    const bashPath = this.getBashShellPath();
    const wrapperPath = path.join(tempDir, 'run-claude.cmd');
    const wrapper = `@echo off\r\ntitle ${title}\r\n"${bashPath}" "${bashScriptPath}"\r\n`;
    await fsPromises.writeFile(wrapperPath, wrapper, 'utf8');
    return wrapperPath;
  }

  private watchRunDone(
    donePath: string,
    tempDir: string,
    markdownPath: string,
    onStopped: (event: ClaudeCodeRunStoppedEvent) => void
  ): void {
    let fired = false;
    const interval = setInterval(async () => {
      try {
        await fsPromises.access(donePath);
      } catch {
        return;
      }

      if (fired) {
        return;
      }

      fired = true;
      clearInterval(interval);
      this.activeRunCleanup = undefined;

      try {
        onStopped({
          markdownPath,
          message: 'Claude Code terminal closed.'
        });
      } finally {
        await this.deleteTempDir(tempDir);
      }
    }, 1000);

    this.activeRunCleanup = () => {
      clearInterval(interval);
    };
  }

  private getBashShellPath(): string {
    const configuredBashPath = process.env.CLAUDE_CODE_GIT_BASH_PATH;

    if (configuredBashPath && fs.existsSync(configuredBashPath)) {
      return configuredBashPath;
    }

    if (process.platform !== 'win32') {
      const shell = process.env.SHELL || '';
      if (path.basename(shell) === 'bash' && fs.existsSync(shell)) {
        return shell;
      }

      for (const candidate of ['/bin/bash', '/usr/bin/bash']) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      return 'bash';
    }

    const windowsCandidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'bash.exe'),
      process.env['ProgramFiles(x86)']
        ? path.join(process.env['ProgramFiles(x86)'] as string, 'Git', 'bin', 'bash.exe')
        : undefined,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')
        : undefined
    ].filter((candidate): candidate is string => Boolean(candidate));

    return windowsCandidates.find(candidate => fs.existsSync(candidate)) || 'bash.exe';
  }

  private getClaudeCodeCommand(markdownPath: string, model?: string, speed?: string): string {
    const normalizedMarkdownPath = markdownPath.replace(/\\/g, '/');
    const prompt = [
      `Read the NWA markdown brief at ${normalizedMarkdownPath}.`,
      'Implement the requested coding work in this workspace.',
      'Keep changes scoped to the brief, run relevant verification, and summarize what changed.'
    ].join(' ');

    const prefix = buildAgentCommandPrefix(model, speed).join(' ');
    return `${prefix} ${this.quoteShellArgument(prompt)}`;
  }

  private quoteShellArgument(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }

  private async deleteTempDir(tempDir: string): Promise<void> {
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
