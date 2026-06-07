import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface TerminalCommand {
  command: string;
  args: string[];
}

export async function openExternalTerminal(scriptPath: string): Promise<void> {
  if (process.platform === 'win32') {
    await spawnDetached('cmd.exe', [
      '/d',
      '/c',
      scriptPath
    ]);
    return;
  }

  if (process.platform === 'darwin') {
    await spawnDetached('open', ['-a', 'Terminal', scriptPath]);
    return;
  }

  await openLinuxExternalTerminal(scriptPath);
}

export async function openExternalPowerShellCommand(options: {
  command: string;
  cwd?: string;
  title?: string;
  completionMessage?: string;
}): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('External PowerShell authentication is only available on Windows.');
  }

  const commandParts = [
    options.title ? `$Host.UI.RawUI.WindowTitle = ${quotePowerShellString(options.title)}` : undefined,
    options.cwd ? `Set-Location -LiteralPath ${quotePowerShellString(options.cwd)}` : undefined,
    '$env:PATH = "$env:USERPROFILE\\.local\\bin;$env:APPDATA\\npm;$env:PATH"',
    options.command,
    'Write-Host ""',
    `Write-Host ${quotePowerShellString(options.completionMessage || 'Command finished. You can close this window.')}`
  ].filter((part): part is string => Boolean(part));

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nwa-auth-'));
  const scriptPath = path.join(tempDir, 'authenticate.ps1');
  await fs.promises.writeFile(scriptPath, `${commandParts.join('\r\n')}\r\n`, 'utf8');

  const launcherPath = path.join(tempDir, 'authenticate.cmd');
  const launcher = [
    '@echo off',
    [
      'start',
      '""',
      quoteCmdArgument(getWindowsPowerShellPath()),
      '-NoExit',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      quoteCmdArgument(scriptPath)
    ].join(' ')
  ].join('\r\n');
  await fs.promises.writeFile(launcherPath, `${launcher}\r\n`, 'utf8');

  await spawnDetached('cmd.exe', ['/d', '/c', launcherPath]);
}

async function openLinuxExternalTerminal(scriptPath: string): Promise<void> {
  const candidates: TerminalCommand[] = [
    { command: 'x-terminal-emulator', args: ['-e', 'bash', scriptPath] },
    { command: 'gnome-terminal', args: ['--', 'bash', scriptPath] },
    { command: 'konsole', args: ['-e', 'bash', scriptPath] },
    { command: 'xfce4-terminal', args: ['-e', `bash ${quoteShellPart(scriptPath)}`] },
    { command: 'xterm', args: ['-e', 'bash', scriptPath] }
  ];

  for (const candidate of candidates) {
    try {
      await spawnDetached(candidate.command, candidate.args);
      return;
    } catch {
      continue;
    }
  }

  throw new Error('Could not open an external terminal window on this Linux system');
}

function getWindowsPowerShellPath(): string {
  const windowsRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const candidate = path.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(candidate) ? candidate : 'powershell.exe';
}

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteCmdArgument(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });

    child.on('error', reject);
    child.on('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function quoteShellPart(part: string): string {
  if (/^[A-Za-z0-9._:/\\-]+$/.test(part)) {
    return part;
  }

  return `"${part.replace(/"/g, '\\"')}"`;
}
