export function getWindowsInstallScript(statusPath: string): string {
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

function Install-CodexCli {
  if (Get-Command codex -ErrorAction SilentlyContinue) {
    Invoke-AgentKitCommand 'Verify Codex CLI' 'codex' @('--version')
    return
  }

  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm is required to install Codex CLI. Install Node.js, then run Init env again.'
  }

  Invoke-AgentKitCommand 'Install Codex CLI' 'npm' @('install', '-g', '@openai/codex')

  if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'Codex CLI installed, but codex was not found on PATH. Restart VS Code or add the npm global bin directory to PATH.'
  }

  Invoke-AgentKitCommand 'Verify Codex CLI' 'codex' @('--version')
}

try {
  Write-Host 'NWA Init env (Windows)'
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
  Write-Host '== Check markitdown =='
  $markitdownReady = $false
  try {
    $markitdownCheckOutput = & $python.Command @($python.Arguments + @('-m', 'markitdown', '--help')) 2>&1
    if ($LASTEXITCODE -eq 0) {
      $markitdownReady = $true
    }
  } catch {
    $markitdownReady = $false
  }

  if ($markitdownReady) {
    Write-Host 'markitdown is already installed. Skipping install.'
  } else {
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
  }

  Invoke-AgentKitCommand 'Verify markitdown' $python.Command ($python.Arguments + @('-m', 'markitdown', '--help'))

  Install-ClaudeCodeCli
  Install-CodexCli

  Write-Host ''
  for ($seconds = 3; $seconds -ge 1; $seconds--) {
    Write-Host "INSTALL SUCCESSFUL!! AUTO CLOSE IN $seconds seconds..."
    Start-Sleep -Seconds 1
  }
  Write-AgentKitStatus 'success' 'markitdown, Claude Code CLI, and Codex CLI are ready'
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

export function getWindowsCommandWrapper(powershellScriptPath: string, statusPath: string): string {
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

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}
