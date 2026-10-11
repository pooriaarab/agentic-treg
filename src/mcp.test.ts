import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, expect, test, vi } from 'vitest';
import { createMcpServer } from './mcp.js';
import { createGuards } from './index.js';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('MCP handshake lists four tools and defaults to safe preview', async () => {
  const mock = vi.fn(); vi.stubGlobal('fetch', mock);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ guards: createGuards({ blocklist: ['blocked'] }) });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(st); await client.connect(ct);
  try {
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name)).toEqual(['treg_search', 'treg_get', 'treg_call', 'treg_doctor']);
    expect(tools.find(t => t.name === 'treg_call')?.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    const preview = await client.callTool({ name: 'treg_call', arguments: { id: 'sample.data' } });
    expect(JSON.parse((preview.content as { text: string }[])[0].text).dryRun).toBe(true);
    const denied = await client.callTool({ name: 'treg_call', arguments: { id: 'sample.data', params: { q: 'blocked' }, live: true } });
    expect(denied.isError).toBe(true);
    expect(mock).not.toHaveBeenCalled();
  } finally { await client.close(); await server.close(); }
});

test('MCP caps read results and errors', async () => {
  vi.stubEnv('TREG_ORG_ID', '7');
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(st); await client.connect(ct);
  try {
    for (const name of ['treg_search', 'treg_get', 'treg_doctor', 'treg_call']) {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ endpoint: {}, text: '😀'.repeat(3000) }))));
      const response = await client.callTool({ name, arguments: name === 'treg_search' ? { query: 'test' } : name === 'treg_doctor' ? {} : { id: 'sample.data', params: { text: '😀'.repeat(3000) } } });
      const output = JSON.parse((response.content as { text: string }[])[0].text);
      expect(output.truncated).toBe(true);
      expect(Buffer.byteLength(JSON.stringify(output.data))).toBeLessThanOrEqual(4000);
    }
  } finally { await client.close(); await server.close(); }
});
