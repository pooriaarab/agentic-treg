import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { callEndpoint, searchCatalog, getEndpoint, getBalance, doctor, VendorError, GuardError, createGuards } from './index.js';
const mock = vi.fn<typeof fetch>();
const detail = { endpoint: { id: 'sample.data', method: 'GET', cost: { usd: 0.001 } } };
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
beforeEach(() => { vi.stubGlobal('fetch', mock); vi.stubEnv('TREG_TOKEN', ''); vi.stubEnv('TREG_ORG_ID', ''); mock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('default preview makes no network request', async () => {
  expect(await callEndpoint('sample.data', { q: 'test' })).toMatchObject({ dryRun: true, network: false });
  expect(mock).not.toHaveBeenCalled();
});
test('live fetches price before spend and records authoritative charge', async () => {
  vi.stubEnv('TREG_TOKEN', 'test-token');
  mock.mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(json({ rows: [1] }, 200, { 'X-Treg-Cost-Micro': '1000' }));
  const result = await callEndpoint('sample.data', { q: 'a b' }, { dryRun: false });
  expect(mock.mock.calls.map(c => c[0])).toEqual(['https://treg.to/catalog/endpoints/sample.data', 'https://treg.to/call/sample.data?q=a+b']);
  expect(mock.mock.calls[1][1]?.headers).toMatchObject({ 'X-Treg-Token': 'test-token', 'X-Treg-Route-Max-Cost': '1' });
  expect(result).toMatchObject({ dryRun: false, truncated: false, chargedMicro: '1000' });
});
test('anonymous live calls omit the token header', async () => {
  mock.mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(json({ ok: true }));
  await callEndpoint('sample.data', {}, { dryRun: false });
  expect(mock.mock.calls[1][1]?.headers).not.toHaveProperty('X-Treg-Token');
});
test('caps multibyte result data at 4000 bytes and marks truncation', async () => {
  mock.mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(json({ text: '😀'.repeat(2000) }));
  const result = await callEndpoint('sample.data', {}, { dryRun: false });
  expect(result.truncated).toBe(true);
  expect(Buffer.byteLength(result.data as string)).toBeLessThanOrEqual(4000);
  expect(Buffer.byteLength(JSON.stringify(result.data))).toBeLessThanOrEqual(4000);
  expect(result.originalBytes).toBeGreaterThan(4000);
});
test('structured parameters support body and path arguments', async () => {
  mock.mockResolvedValueOnce(json({ endpoint: { ...detail.endpoint, method: 'POST', input: { body: {} } } })).mockResolvedValueOnce(json({ ok: true }));
  await callEndpoint('sample.data', { queryParams: { limit: 2 }, pathParams: { item: 3 }, body: { text: 'hello' } }, { dryRun: false });
  expect(mock.mock.calls[1][0]).toBe('https://treg.to/call/sample.data?limit=2&item=3');
  expect(mock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{"text":"hello"}' });
});
test.each([401, 402, 429, 500])('HTTP %s throws VendorError before spend', async status => {
  mock.mockResolvedValueOnce(json({ detail: 'denied' }, status));
  await expect(callEndpoint('sample.data', {}, { dryRun: false })).rejects.toMatchObject({ code: 'VENDOR_FAILED', status });
  expect(mock).toHaveBeenCalledTimes(1);
});
test('network errors and vendor errors throw without leaking token', async () => {
  vi.stubEnv('TREG_TOKEN', 'test-token');
  mock.mockRejectedValueOnce(new Error('test-token failure'));
  await expect(searchCatalog('test')).rejects.toThrow('[redacted] failure');
  mock.mockResolvedValueOnce(json({ error: 'vendor failure' }));
  await expect(searchCatalog('test')).rejects.toBeInstanceOf(VendorError);
});
test('missing price denies spending', async () => {
  mock.mockResolvedValueOnce(json({ endpoint: { method: 'GET' } }));
  await expect(callEndpoint('sample.data', {}, { dryRun: false })).rejects.toBeInstanceOf(VendorError);
  expect(mock).toHaveBeenCalledTimes(1);
});
test('call HTTP failure propagates', async () => {
  mock.mockResolvedValueOnce(json(detail)).mockResolvedValueOnce(json({ detail: 'upstream error' }, 502));
  await expect(callEndpoint('sample.data', {}, { dryRun: false })).rejects.toBeInstanceOf(VendorError);
});
test('guard denies preview and live without network', async () => {
  const guards = createGuards({ blocklist: ['blocked'] });
  for (const dryRun of [true, false]) await expect(callEndpoint('sample.data', { q: 'blocked' }, { guards, dryRun })).rejects.toBeInstanceOf(GuardError);
  await expect(getEndpoint('../escape')).rejects.toBeInstanceOf(GuardError);
  expect(mock).not.toHaveBeenCalled();
});
test('catalog search encodes query', async () => {
  mock.mockResolvedValueOnce(json({ results: [] }));
  await searchCatalog('a & b');
  expect(mock.mock.calls[0][0]).toBe('https://treg.to/catalog/search?q=a+%26+b');
});
test('balance discovers one org and refuses ambiguous selection', async () => {
  mock.mockResolvedValueOnce(json([{ id: 7 }])).mockResolvedValueOnce(json({ balance_micro: 100 }));
  expect(await getBalance()).toEqual({ balance_micro: 100 });
  expect(mock.mock.calls[1][0]).toBe('https://treg.to/orgs/7/balance');
  mock.mockResolvedValueOnce(json([{ id: 7 }, { id: 8 }]));
  await expect(getBalance()).rejects.toThrow('TREG_ORG_ID');
});
test('doctor reports unset token and balance failure explicitly', async () => {
  mock.mockResolvedValueOnce(json({ public_url: 'https://treg.to' })).mockResolvedValueOnce(json({ detail: 'not authenticated' }, 401));
  expect(await doctor()).toMatchObject({ token: 'unset', reachable: true, ok: false, balanceError: 'HTTP 401: {"detail":"not authenticated"}' });
});
