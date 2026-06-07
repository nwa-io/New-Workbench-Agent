export function getPosixInstallScript(statusPath: string, platformName: string): string {
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

install_codex_cli() {
  if command -v codex >/dev/null 2>&1; then
    run_required "Verify Codex CLI" codex --version
    return
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "INSTALL FAILED: npm is required to install Codex CLI. Install Node.js, then run Init env again."
    write_status failed "npm is required to install Codex CLI. Install Node.js, then run Init env again."
    echo "Press Enter to close..."
    read -r _
    exit 1
  fi

  run_required "Install Codex CLI" npm install -g @openai/codex
  run_required "Verify Codex CLI" codex --version
}

echo "NWA Init env (${platformName})"
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
echo "== Check markitdown =="
if "$PYTHON_CMD" -m markitdown --help >/dev/null 2>&1; then
  echo "markitdown is already installed. Skipping install."
else
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
fi

run_required "Verify markitdown" "$PYTHON_CMD" -m markitdown --help

install_claude_code_cli
install_codex_cli

echo
for seconds in 3 2 1; do
  echo "INSTALL SUCCESSFUL!! AUTO CLOSE IN $seconds seconds..."
  sleep 1
done
write_status success "markitdown, Claude Code CLI, and Codex CLI are ready"
exit 0
`;
}
