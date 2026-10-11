#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { VERSION, DEFAULT_BRAND, searchCatalog, getEndpoint, callEndpoint, getBalance, doctor, safeMessage, capOutput, type Params } from './index.js';
export class UsageError extends Error {}
export function parseArgs(argv: string[]) {
  const args = [...argv];
  let command = args.shift() ?? 'help';
  if (args.includes('--help') || ['--help', '-h'].includes(command)) return { command: 'help', value: '', params: {}, dryRun: true };
  if (['--version', '-V'].includes(command)) command = 'version';
  if (!['help', 'version', 'search', 'get', 'call', 'balance', 'doctor', 'mcp'].includes(command)) throw new UsageError('Unknown command.');
  let dryRun = true;
  let value = '';
  let params: Params = {};
  while (args.length) {
    const arg = args.shift()!;
    if (arg === '--live' && command === 'call') { dryRun = false; continue; }
    if (arg === '--dry-run' && command === 'call') { dryRun = true; continue; }
    if (arg === '--params' && command === 'call') {
      try { params = JSON.parse(args.shift() ?? ''); } catch { throw new UsageError('--params needs JSON.'); }
      if (!params || typeof params !== 'object' || Array.isArray(params)) throw new UsageError('--params needs an object.');
      continue;
    }
    if (!arg.startsWith('-') && !value && ['search', 'get', 'call'].includes(command)) { value = arg; continue; }
    throw new UsageError('Unexpected argument.');
  }
  if (['search', 'get', 'call'].includes(command) && !value) throw new UsageError('Provide a query or endpoint id.');
  return { command, value, params, dryRun };
}
export const HELP = `${DEFAULT_BRAND.command} ${VERSION}
${DEFAULT_BRAND.description}
Usage: agentic-treg <command>
  search <query>              Search the free catalog.
  get <id>                    Read parameters and price.
  call <id> [--params JSON] [--dry-run | --live]
                              Preview without network; --live spends.
  balance                     Read prepaid balance.
  doctor                      Report token status and connectivity.
  mcp                         Start the stdio MCP server.
  --help                      Print help.
  --version                   Print version.`;
export async function runCli(argv: string[], io = { out: (s: string) => console.log(s), err: (s: string) => console.error(s) }): Promise<number> {
  try {
    const r = parseArgs(argv);
    if (r.command === 'help') { io.out(HELP); return 0; }
    if (r.command === 'version') { io.out(VERSION); return 0; }
    if (r.command === 'mcp') { await (await import('./mcp.js')).startMcp(); return 0; }
    const result = r.command === 'search' ? await searchCatalog(r.value) : r.command === 'get' ? await getEndpoint(r.value) : r.command === 'call' ? await callEndpoint(r.value, r.params, { dryRun: r.dryRun }) : r.command === 'balance' ? await getBalance() : await doctor();
    io.out(safeMessage(JSON.stringify(capOutput(result))));
    if (r.command === 'doctor' && !(result as { ok: boolean }).ok) { io.err('Doctor detected a failure.'); return 1; }
    return 0;
  } catch (error) { io.err(safeMessage(error)); return error instanceof UsageError ? 2 : 1; }
}
function isMain(): boolean {
  try { return !!process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url; } catch { return false; }
}
if (isMain()) runCli(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(safeMessage(error)); process.exitCode = 1; });
