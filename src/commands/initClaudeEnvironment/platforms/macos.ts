import { getPosixInstallScript } from './posix';

export function getMacosInstallScript(statusPath: string): string {
  return getPosixInstallScript(statusPath, 'macOS');
}
