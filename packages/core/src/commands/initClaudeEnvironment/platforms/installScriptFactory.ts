import * as fs from 'fs/promises';
import * as path from 'path';
import { getLinuxInstallScript } from './linux';
import { getMacosInstallScript } from './macos';
import { getWindowsCommandWrapper, getWindowsInstallScript } from './windows';

export async function createPlatformInstallScript(
  platform: NodeJS.Platform,
  tempDirectory: string,
  statusPath: string
): Promise<string> {
  if (platform === 'win32') {
    const powershellScriptPath = path.join(tempDirectory, 'init-env.ps1');
    const commandScriptPath = path.join(tempDirectory, 'init-env.cmd');
    await fs.writeFile(powershellScriptPath, getWindowsInstallScript(statusPath), 'utf8');
    await fs.writeFile(commandScriptPath, getWindowsCommandWrapper(powershellScriptPath, statusPath), 'utf8');
    return commandScriptPath;
  }

  const isMacos = platform === 'darwin';
  const scriptPath = path.join(tempDirectory, isMacos ? 'init-env-macos.sh' : 'init-env-linux.sh');
  const script = isMacos ? getMacosInstallScript(statusPath) : getLinuxInstallScript(statusPath);
  await fs.writeFile(scriptPath, script, 'utf8');
  await fs.chmod(scriptPath, 0o755);
  return scriptPath;
}
