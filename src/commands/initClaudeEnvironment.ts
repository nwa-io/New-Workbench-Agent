import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { logger } from '../utils/logger';
import { openExternalTerminal } from '../utils/externalTerminal';

interface InstallStatus {
  status: 'success' | 'failed';
  message: string;
}

export async function initClaudeEnvironmentCommand(): Promise<void> {
  try {
    const workspaceFolder = await getWorkspaceFolderOrPrompt();
    if (!workspaceFolder) {
      return;
    }

    await ensureProjectDocsFolder(workspaceFolder);

    await runEnvironmentSetupInExternalTerminal();

    vscode.window.showInformationMessage('NWA: Init env complete. Claude Code CLI and markitdown are ready.');
  } catch (error) {
    logger.error('Error initializing Claude environment', error as Error);
    vscode.window.showErrorMessage(`NWA Error: ${(error as Error).message}`);
  }
}

async function getWorkspaceFolderOrPrompt(): Promise<vscode.Uri | undefined> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (workspaceFolder) {
    return workspaceFolder;
  }

  const selectedFolders = await vscode.window.showOpenDialog({
    title: 'Select a workspace folder for NWA Init env',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Open Folder'
  });

  if (!selectedFolders?.[0]) {
    vscode.window.showErrorMessage('NWA: Please open or select a workspace folder before running Init env');
    return undefined;
  }

  const addedWorkspaceFolder = vscode.workspace.updateWorkspaceFolders(
    vscode.workspace.workspaceFolders?.length ?? 0,
    0,
    { uri: selectedFolders[0] }
  );

  if (!addedWorkspaceFolder) {
    vscode.window.showInformationMessage('NWA: Using the selected folder for this Init env run');
  }

  return selectedFolders[0];
}

async function ensureProjectDocsFolder(workspaceFolder: vscode.Uri): Promise<vscode.Uri> {
  const docsFolder = vscode.Uri.joinPath(workspaceFolder, '.project', 'docs');
  await vscode.workspace.fs.createDirectory(docsFolder);
  return docsFolder;
}

async function runEnvironmentSetupInExternalTerminal(): Promise<void> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'agentkit-init-env-'));
  const statusPath = path.join(tempDirectory, 'status.json');
  const scriptPath = await createInstallScript(tempDirectory, statusPath);

  await openExternalTerminal(scriptPath);

  const status = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'NWA: Waiting for Init env terminal',
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ message: 'Installing markitdown and Claude Code CLI in external terminal' });
      return waitForInstallStatus(statusPath, token);
    }
  );

  if (status.status !== 'success') {
    throw new Error(status.message || 'Init env installation failed');
  }
}

async function createInstallScript(tempDirectory: string, statusPath: string): Promise<string> {
  if (process.platform === 'win32') {
    const powershellScriptPath = path.join(tempDirectory, 'init-env.ps1');
    const commandScriptPath = path.join(tempDirectory, 'init-env.cmd');
    await fs.writeFile(powershellScriptPath, getWindowsInstallScript(statusPath), 'utf8');
    await fs.writeFile(commandScriptPath, getWindowsCommandWrapper(powershellScriptPath, statusPath), 'utf8');
    return commandScriptPath;
  }

  const scriptPath = path.join(tempDirectory, 'init-env.sh');
  await fs.writeFile(scriptPath, getUnixInstallScript(statusPath), 'utf8');
  await fs.chmod(scriptPath, 0o755);
  return scriptPath;
}

async function waitForInstallStatus(
  statusPath: string,
  token?: vscode.CancellationToken
): Promise<InstallStatus> {
  const startedAt = Date.now();
  const timeoutMs = 30 * 60 * 1000;

  while (Date.now() - startedAt < timeoutMs) {
    if (token?.isCancellationRequested) {
      throw new Error('Init env was cancelled');
    }

    const status = await readInstallStatus(statusPath);
    if (status) {
      return status;
    }

    await delay(1000);
  }

  throw new Error('Timed out waiting for Init env terminal to finish');
}

async function readInstallStatus(statusPath: string): Promise<InstallStatus | undefined> {
  try {
    const content = await fs.readFile(statusPath, 'utf8');
    const status = JSON.parse(stripJsonBom(content).trim()) as InstallStatus;

    if (status.status === 'success' || status.status === 'failed') {
      return status;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function stripJsonBom(content: string): string {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
}

function getWindowsInstallScript(statusPath: string): string {
  const escapedStatusPath = escapePowerShellString(statusPath);

  return `$ErrorActionPreference = 'Stop'

function Write-AgentKitStatus {
  param([string]$Status, [string]$Message)
  $json = @{ status = $Status; message = $Message } | ConvertTo-Json -Compress
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText('${escapedStatusPath}', $json, $utf8NoBom)
}

function Invoke-AgentKitCommand {
  param([string]$Title, [string]$Command, [string[]]$Arguments)
  Write-Host ''
  Write-Host "== $Title =="
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Title failed with exit code $LASTEXITCODE"
  }
}

function Test-AgentKitPathContains {
  param([string]$PathList, [string]$Entry)

  foreach ($pathItem in ($PathList -split ';')) {
    if ($pathItem.Trim().TrimEnd([char]92) -ieq $Entry.TrimEnd([char]92)) {
      return $true
    }
  }

  return $false
}

function Add-ClaudeLocalBinToPath {
  $localBin = Join-Path $env:USERPROFILE '.local\\bin'

  if (Test-Path $localBin) {
    if (-not (Test-AgentKitPathContains $env:PATH $localBin)) {
      $env:PATH = "$localBin;$env:PATH"
    }
  }

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $userPath) {
    $userPath = ''
  }

  if (-not (Test-AgentKitPathContains $userPath $localBin)) {
    $nextUserPath = if ($userPath) { "$localBin;$userPath" } else { $localBin }
    [Environment]::SetEnvironmentVariable('Path', $nextUserPath, 'User')
    Write-Host "Added Claude Code native install directory to user PATH: $localBin"
  }
}

function Install-ClaudeCodeCli {
  Add-ClaudeLocalBinToPath

  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Invoke-AgentKitCommand 'Verify Claude Code CLI' 'claude' @('--version')
    return
  }

  Write-Host ''
  Write-Host '== Install Claude Code CLI =='
  Write-Host 'Downloading official Claude Code native installer...'

  $installerPath = Join-Path ([System.IO.Path]::GetTempPath()) ("claude-install-" + [System.Guid]::NewGuid().ToString() + ".ps1")
  Invoke-WebRequest -UseBasicParsing -Uri 'https://claude.ai/install.ps1' -OutFile $installerPath
  & $installerPath
  if ($LASTEXITCODE -ne 0) {
    throw "Claude Code installer failed with exit code $LASTEXITCODE"
  }

  Add-ClaudeLocalBinToPath

  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    $claudeExe = Join-Path $env:USERPROFILE '.local\\bin\\claude.exe'
    if (Test-Path $claudeExe) {
      Invoke-AgentKitCommand 'Verify Claude Code CLI' $claudeExe @('--version')
      return
    }

    throw "Claude Code installed, but claude was not found. Add $env:USERPROFILE\\.local\\bin to PATH and restart VS Code."
  }

  Invoke-AgentKitCommand 'Verify Claude Code CLI' 'claude' @('--version')
}

try {
  Write-Host 'NWA Init env'
  Write-Host 'Checking Python...'

  $pythonCandidates = @(
    @{ Command = 'python'; Arguments = @(); Label = 'python' },
    @{ Command = 'python3'; Arguments = @(); Label = 'python3' },
    @{ Command = 'py'; Arguments = @('-3'); Label = 'py -3' }
  )
  $python = $null

  foreach ($candidate in $pythonCandidates) {
    try {
      $versionOutput = & $candidate.Command @($candidate.Arguments + @('--version')) 2>&1
      if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match 'Python 3\\.') {
        $python = $candidate
        break
      }
    } catch {
      continue
    }
  }

  if (-not $python) {
    throw 'Python 3 was not found on PATH'
  }

  Write-Host "Using Python command: $($python.Label)"

  Write-Host ''
  Write-Host '== Ensure pip =='
  & $python.Command @($python.Arguments + @('-m', 'ensurepip', '--upgrade'))
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'ensurepip did not complete successfully. Checking existing pip commands...'
  }

  $pipCandidates = @(
    @{ Command = $python.Command; Arguments = $python.Arguments + @('-m', 'pip'); Label = "$($python.Label) -m pip" },
    @{ Command = 'pip'; Arguments = @(); Label = 'pip' },
    @{ Command = 'pip3'; Arguments = @(); Label = 'pip3' }
  )
  $pip = $null

  foreach ($candidate in $pipCandidates) {
    try {
      & $candidate.Command @($candidate.Arguments + @('--version'))
      if ($LASTEXITCODE -eq 0) {
        $pip = $candidate
        break
      }
    } catch {
      continue
    }
  }

  if (-not $pip) {
    throw 'pip is not available'
  }

  Write-Host "Using pip command: $($pip.Label)"

  Write-Host ''
  Write-Host '== Install markitdown =='
  $markitdownPackage = 'markitdown[pdf,docx,pptx,xls,xlsx]'
  & $pip.Command @($pip.Arguments + @('install', $markitdownPackage))
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'pip install markitdown failed. Retrying with --user...'
    Invoke-AgentKitCommand 'Install markitdown with --user' $pip.Command ($pip.Arguments + @('install', '--user', $markitdownPackage))
  }

  Invoke-AgentKitCommand 'Verify markitdown' $python.Command ($python.Arguments + @('-m', 'markitdown', '--help'))

  Install-ClaudeCodeCli

  Write-Host ''
  for ($seconds = 3; $seconds -ge 1; $seconds--) {
    Write-Host "INSTALL SUCCESSFUL!! AUTO CLOSE IN $seconds seconds..."
    Start-Sleep -Seconds 1
  }
  Write-AgentKitStatus 'success' 'markitdown and Claude Code CLI installed successfully'
  exit 0
} catch {
  Write-AgentKitStatus 'failed' $_.Exception.Message
  Write-Host ''
  Write-Host "INSTALL FAILED: $($_.Exception.Message)"
  Write-Host 'Press any key to close...'
  [void][System.Console]::ReadKey($true)
  exit 1
}
`;
}

function getWindowsCommandWrapper(powershellScriptPath: string, statusPath: string): string {
  return `@echo off
setlocal
title NWA Init env
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${powershellScriptPath}"
set "EXIT_CODE=%ERRORLEVEL%"
if not exist "${statusPath}" (
  >"${statusPath}" echo {"status":"failed","message":"PowerShell could not run init-env.ps1"}
  echo.
  echo INSTALL FAILED: PowerShell could not run init-env.ps1
  echo Press any key to close...
  pause >nul
)
exit /b %EXIT_CODE%
`;
}

function getUnixInstallScript(statusPath: string): string {
  return `#!/usr/bin/env bash
set -u

write_status() {
  local status="$1"
  local message="$2"
  python_status_writer=$(command -v python3 || command -v python || true)
  if [ -n "$python_status_writer" ]; then
    "$python_status_writer" - <<'PY' "${statusPath}" "$status" "$message"
import json
import sys

path, status, message = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, 'w', encoding='utf-8') as handle:
    json.dump({'status': status, 'message': message}, handle)
PY
  else
    printf '{"status":"%s","message":"%s"}' "$status" "$message" > "${statusPath}"
  fi
}

run_required() {
  local title="$1"
  shift
  echo
  echo "== $title =="
  "$@"
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    echo "INSTALL FAILED: $title failed with exit code $exit_code"
    write_status failed "$title failed with exit code $exit_code"
    echo "Press Enter to close..."
    read -r _
    exit "$exit_code"
  fi
}

add_claude_local_bin_to_path() {
  local local_bin="$HOME/.local/bin"

  if [ -d "$local_bin" ]; then
    case ":$PATH:" in
      *":$local_bin:"*) ;;
      *) export PATH="$local_bin:$PATH" ;;
    esac
  fi
}

persist_claude_local_bin_to_path() {
  local local_bin="$HOME/.local/bin"
  local line='export PATH="$HOME/.local/bin:$PATH"'
  local profile_file="$HOME/.bashrc"

  case "\${SHELL:-}" in
    */zsh) profile_file="$HOME/.zshrc" ;;
    */fish) profile_file="" ;;
  esac

  if [ -z "$profile_file" ]; then
    echo "Claude Code installed at $local_bin. Add that directory to PATH for future shell sessions."
    return
  fi

  if [ ! -f "$profile_file" ]; then
    printf '%s\\n' "$line" > "$profile_file"
    echo "Added Claude Code native install directory to PATH in $profile_file"
    return
  fi

  if ! grep -Fxq "$line" "$profile_file"; then
    printf '\\n%s\\n' "$line" >> "$profile_file"
    echo "Added Claude Code native install directory to PATH in $profile_file"
  fi
}

install_claude_code_cli() {
  add_claude_local_bin_to_path

  if command -v claude >/dev/null 2>&1; then
    run_required "Verify Claude Code CLI" claude --version
    return
  fi

  echo
  echo "== Install Claude Code CLI =="
  echo "Downloading official Claude Code native installer..."

  installer_path="$(mktemp -t claude-install.XXXXXX)"
  if command -v curl >/dev/null 2>&1; then
    run_required "Download Claude Code installer" curl -fsSL https://claude.ai/install.sh -o "$installer_path"
  elif command -v wget >/dev/null 2>&1; then
    run_required "Download Claude Code installer" wget -qO "$installer_path" https://claude.ai/install.sh
  else
    echo "INSTALL FAILED: curl or wget is required to install Claude Code CLI"
    write_status failed "curl or wget is required to install Claude Code CLI"
    echo "Press Enter to close..."
    read -r _
    exit 1
  fi

  run_required "Install Claude Code CLI" bash "$installer_path"
  add_claude_local_bin_to_path
  persist_claude_local_bin_to_path

  run_required "Verify Claude Code CLI" claude --version
}

echo "NWA Init env"
echo "Checking Python..."

PYTHON_CMD=""
for candidate in python python3; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" --version 2>&1 | grep -q 'Python 3\\.'; then
    PYTHON_CMD="$candidate"
    break
  fi
done

if [ -z "$PYTHON_CMD" ]; then
  echo "INSTALL FAILED: Python 3 was not found on PATH"
  write_status failed "Python 3 was not found on PATH"
  echo "Press Enter to close..."
  read -r _
  exit 1
fi

echo "Using Python command: $PYTHON_CMD"

echo
echo "== Ensure pip =="
"$PYTHON_CMD" -m ensurepip --upgrade || echo "ensurepip did not complete successfully. Checking existing pip commands..."

PIP_CMD=""
PIP_ARGS=""
if "$PYTHON_CMD" -m pip --version >/dev/null 2>&1; then
  PIP_CMD="$PYTHON_CMD"
  PIP_ARGS="-m pip"
elif command -v pip >/dev/null 2>&1 && pip --version >/dev/null 2>&1; then
  PIP_CMD="pip"
elif command -v pip3 >/dev/null 2>&1 && pip3 --version >/dev/null 2>&1; then
  PIP_CMD="pip3"
fi

if [ -z "$PIP_CMD" ]; then
  echo "INSTALL FAILED: pip is not available"
  write_status failed "pip is not available"
  echo "Press Enter to close..."
  read -r _
  exit 1
fi

echo "Using pip command: $PIP_CMD $PIP_ARGS"

echo
echo "== Install markitdown =="
MARKITDOWN_PACKAGE='markitdown[pdf,docx,pptx,xls,xlsx]'
if ! $PIP_CMD $PIP_ARGS install "$MARKITDOWN_PACKAGE"; then
  echo "pip install markitdown failed. Retrying with --user..."
  run_required "Install markitdown with --user" $PIP_CMD $PIP_ARGS install --user "$MARKITDOWN_PACKAGE"
fi

run_required "Verify markitdown" "$PYTHON_CMD" -m markitdown --help

install_claude_code_cli

echo
for seconds in 3 2 1; do
  echo "INSTALL SUCCESSFUL!! AUTO CLOSE IN $seconds seconds..."
  sleep 1
done
write_status success "markitdown and Claude Code CLI installed successfully"
exit 0
`;
}

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
