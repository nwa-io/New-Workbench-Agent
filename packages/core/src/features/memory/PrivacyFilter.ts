const SENSITIVE_KEYS = new Set([
  'access_token', 'accesstoken', 'refresh_token', 'refreshtoken',
  'api_key', 'apikey', 'password', 'passwd', 'pwd',
  'secret', 'private_key', 'privatekey', 'authorization',
  'auth_token', 'authtoken', 'bearer', 'credential', 'token'
]);

const SENSITIVE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /token["']?\s*[=:]\s*["']?[A-Za-z0-9\-._~+/]{10,}["']?/gi,
  /key["']?\s*[=:]\s*["']?[A-Za-z0-9\-._~+/]{20,}["']?/gi,
  /password["']?\s*[=:]\s*["']?[^\s"',}{]{3,}["']?/gi,
  /secret["']?\s*[=:]\s*["']?[^\s"',}{]{6,}["']?/gi
];

export class PrivacyFilter {
  filterText(text: string): string {
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  filterObject<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        result[key] = this.filterText(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'string'
            ? this.filterText(item)
            : typeof item === 'object' && item !== null
              ? this.filterObject(item as Record<string, unknown>)
              : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.filterObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  private isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase().replace(/[-_]/g, '');
    return SENSITIVE_KEYS.has(lower) || [...SENSITIVE_KEYS].some(s => lower.includes(s));
  }
}
