import { getPosixInstallScript } from './posix';

export function getLinuxInstallScript(statusPath: string): string {
  return getPosixInstallScript(statusPath, 'Linux');
}
