import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { VERSION, searchCatalog, getEndpoint, callEndpoint, doctor, safeMessage, capOutput, type CallOptions } from './index.js';
async function result(run: () => Promise<unknown>) {
  try { return { content: [{ type: 'text' as const, text: safeMessage(JSON.stringify(capOutput(await run()))) }] }; }
  catch (error) { return { isError: true, content: [{ type: 'text' as const, text: safeMessage(JSON.stringify(capOutput({ error: safeMessage(error) }))) }] }; }
}
export function createMcpServer(options: Pick<CallOptions, 'guards'> = {}) {
  const server = new McpServer({ name: 'agentic-treg', version: VERSION });
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
  server.registerTool('treg_search', { description: 'Search the free catalog.', inputSchema: { query: z.string() }, annotations: read }, ({ query }) => result(() => searchCatalog(query)));
  server.registerTool('treg_get', { description: 'Read endpoint parameters and price.', inputSchema: { id: z.string() }, annotations: read }, ({ id }) => result(() => getEndpoint(id)));
  server.registerTool('treg_call', { description: 'Preview by default. Explicit live calls may spend or publish.', inputSchema: { id: z.string(), params: z.record(z.unknown()).optional(), live: z.boolean().default(false) }, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, ({ id, params, live }) => result(() => callEndpoint(id, params, { ...options, dryRun: !live })));
  server.registerTool('treg_doctor', { description: 'Check token status, reachability, and balance.', inputSchema: {}, annotations: read }, () => result(async () => { const report = await doctor(); if (!report.ok) throw new Error(JSON.stringify(report)); return report; }));
  return server;
}
export async function startMcp() { await createMcpServer().connect(new StdioServerTransport()); }
