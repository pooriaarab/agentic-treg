import { afterEach, expect, test, vi } from 'vitest';
import { parseArgs, runCli } from './cli.js';
afterEach(() => vi.unstubAllGlobals());
test('argument parsing uses dry run unless live is explicit', () => {
  expect(parseArgs(['call', 'sample.data']).dryRun).toBe(true);
  expect(parseArgs(['call', 'sample.data', '--live', '--params', '{"q":"test"}'])).toMatchObject({ dryRun: false, params: { q: 'test' } });
  expect(parseArgs(['search', 'seo', '--dry-run']).command).toBe('search');
  expect(parseArgs(['--version']).command).toBe('version');
  expect(() => parseArgs(['call'])).toThrow();
  expect(() => parseArgs(['call', 'x', '--params', '[]'])).toThrow();
  expect(() => parseArgs(['balance', '--live'])).toThrow();
});
test('CLI preview and help execute without network', async () => {
  const mock = vi.fn(); vi.stubGlobal('fetch', mock);
  const out = vi.fn(); const err = vi.fn();
  expect(await runCli(['call', 'sample.data'], { out, err })).toBe(0);
  expect(JSON.parse(out.mock.calls[0][0])).toMatchObject({ dryRun: true });
  expect(await runCli(['--help'], { out, err })).toBe(0);
  expect(out.mock.calls[1][0]).toContain('doctor');
  expect(mock).not.toHaveBeenCalled();
});
test('CLI failure returns nonzero and writes stderr', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const out = vi.fn(); const err = vi.fn();
  expect(await runCli(['search', 'test'], { out, err })).toBe(1);
  expect(err.mock.calls[0][0]).toContain('offline');
  expect(out).not.toHaveBeenCalled();
});
