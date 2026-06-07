import { PrivacyFilter } from '../../features/memory/PrivacyFilter';

const filter = new PrivacyFilter();

describe('PrivacyFilter.filterText', () => {
  it('redacts Bearer tokens', () => {
    const result = filter.filterText('Authorization: Bearer abc123xyz456');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('abc123xyz456');
  });

  it('redacts token= patterns', () => {
    const result = filter.filterText('token=supersecretvalue123');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts password= patterns', () => {
    const result = filter.filterText('password=mypassword');
    expect(result).toContain('[REDACTED]');
  });

  it('leaves normal text unchanged', () => {
    const result = filter.filterText('This is a normal summary about workflows.');
    expect(result).toBe('This is a normal summary about workflows.');
  });
});

describe('PrivacyFilter.filterObject', () => {
  it('redacts sensitive keys', () => {
    const obj = { api_key: 'sk-1234', title: 'hello' };
    const result = filter.filterObject(obj);
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.title).toBe('hello');
  });

  it('redacts nested sensitive keys', () => {
    const obj = { config: { password: 'secret123', name: 'test' } };
    const result = filter.filterObject(obj) as typeof obj;
    expect((result.config as Record<string, string>).password).toBe('[REDACTED]');
    expect((result.config as Record<string, string>).name).toBe('test');
  });

  it('redacts token in string values', () => {
    const obj = { description: 'access token=abc123longvalue is set' };
    const result = filter.filterObject(obj);
    expect(result.description).not.toContain('abc123longvalue');
  });

  it('does not mutate the original object', () => {
    const obj = { access_token: 'secret', note: 'hi' };
    filter.filterObject(obj);
    expect(obj.access_token).toBe('secret');
  });
});
