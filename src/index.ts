import { defineBrand, createLogger, createGuards, VendorError, GuardError, type Guards } from 'agentic-core';
export { VendorError, GuardError, createGuards } from 'agentic-core';
export const VERSION = '0.1.0';
export const BASE_URL = 'https://treg.to';
export const DEFAULT_BRAND = defineBrand({ name: 'agentic-treg', command: 'agentic-treg', description: 'Route live data through a catalog with a CLI, npm library, and MCP server.', version: VERSION, keywords: ['seo', 'serp-data', 'enrichment', 'keywords', 'trends', 'agentic-suite', 'claude-code', 'codex', 'cli', 'mcp'] });
const logger = createLogger({ quiet: true });
export type Params = Record<string, unknown>;
export interface EndpointDetail { endpoint: { id: string; method: string; cost: Record<string, unknown>; input?: { body?: unknown; queryParams?: unknown; pathParams?: unknown; bodyType?: string } }; [key: string]: unknown }
export function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const token = process.env.TREG_TOKEN;
  return token ? message.split(token).join('[redacted]') : message;
}
function headers(): Record<string, string> {
  return process.env.TREG_TOKEN ? { 'X-Treg-Token': process.env.TREG_TOKEN } : {};
}
async function request(path: string, init: RequestInit = {}): Promise<{ data: unknown; response: Response }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    const text = safeMessage(await response.text());
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!response.ok) throw new VendorError(`HTTP ${response.status}: ${safeMessage(text).slice(0, 1000)}`, { status: response.status });
    if (data && typeof data === 'object' && ('error' in data || ('success' in data && data.success === false))) {
      throw new VendorError(`Vendor failure: ${safeMessage(JSON.stringify(data)).slice(0, 1000)}`);
    }
    return { data, response };
  } catch (error) {
    if (error instanceof VendorError) throw error;
    throw new VendorError(`Request failed: ${safeMessage(error)}`);
  }
}
function checkId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)) throw new GuardError('Use a catalog endpoint id.');
}
export async function searchCatalog(query: string): Promise<unknown> {
  return (await request(`/catalog/search?${new URLSearchParams({ q: query })}`)).data;
}
export async function getEndpoint(id: string): Promise<EndpointDetail> {
  checkId(id);
  const data = (await request(`/catalog/endpoints/${encodeURIComponent(id)}`)).data;
  if (!data || typeof data !== 'object' || !('endpoint' in data) || !data.endpoint || typeof data.endpoint !== 'object') throw new VendorError('Invalid endpoint detail.');
  return data as EndpointDetail;
}
function queryString(params: Params): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return query.toString();
}
function asParams(value: unknown): Params {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GuardError('Query and path parameters must be objects.');
  return value as Params;
}
export interface CallOptions { dryRun?: boolean; guards?: Guards; maxCostUsd?: number }
export async function callEndpoint(id: string, params: Params = {}, options: CallOptions = {}) {
  checkId(id);
  const guards = options.guards ?? createGuards();
  guards.checkDispatch(JSON.stringify({ id, params }));
  const maxCostUsd = options.maxCostUsd ?? 1;
  if (!Number.isFinite(maxCostUsd) || maxCostUsd < 0) throw new GuardError('maxCostUsd must be finite and nonnegative.');
  if (options.dryRun !== false) return { dryRun: true, id, params, maxCostUsd, network: false };
  const detail = await getEndpoint(id);
  const { endpoint } = detail;
  if (!endpoint.cost || typeof endpoint.cost !== 'object' || !('usd' in endpoint.cost)) throw new VendorError('Endpoint has no published price.');
  const method = endpoint.method?.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) throw new VendorError('Unsupported endpoint method.');
  const structured = 'queryParams' in params || 'pathParams' in params || 'body' in params;
  const query = structured ? { ...asParams(params.queryParams ?? {}), ...asParams(params.pathParams ?? {}) } : method === 'GET' || method === 'HEAD' || !endpoint.input?.body ? params : {};
  const body = structured ? params.body : method !== 'GET' && method !== 'HEAD' && endpoint.input?.body ? params : undefined;
  if ((method === 'GET' || method === 'HEAD') && body !== undefined) throw new GuardError('This method accepts no body.');
  const qs = queryString(query);
  const { data, response } = await request(`/call/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`, { method, headers: { 'X-Treg-Route-Max-Cost': String(maxCostUsd), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  guards.recordDispatch();
  logger.info('Call completed.');
  const serialized = JSON.stringify(data);
  const bytes = Buffer.byteLength(serialized);
  const truncated = bytes > 4000;
  let result = data;
  if (truncated) {
    let text = Buffer.from(serialized).subarray(0, 4000).toString('utf8');
    while (Buffer.byteLength(JSON.stringify(text)) > 4000) text = text.slice(0, -1);
    result = text;
  }
  return { dryRun: false, id, price: endpoint.cost, data: result, truncated, originalBytes: bytes, callId: response.headers.get('X-Treg-Call-Id'), chargedMicro: response.headers.get('X-Treg-Cost-Micro') };
}
export async function getBalance(): Promise<unknown> {
  let orgId = process.env.TREG_ORG_ID;
  if (!orgId) {
    const orgs = (await request('/orgs')).data;
    if (!Array.isArray(orgs) || orgs.length !== 1 || !orgs[0]?.id) throw new VendorError('Set TREG_ORG_ID when organization selection is ambiguous.');
    orgId = String(orgs[0].id);
  }
  if (!/^\d+$/.test(orgId)) throw new GuardError('TREG_ORG_ID must be a numeric organization id.');
  return (await request(`/orgs/${orgId}/balance`)).data;
}
export async function doctor() {
  let reachabilityError: string | undefined;
  let balanceError: string | undefined;
  let balance: unknown;
  try { await request('/meta'); } catch (error) { reachabilityError = safeMessage(error); }
  try { balance = await getBalance(); } catch (error) { balanceError = safeMessage(error); }
  return { token: process.env.TREG_TOKEN ? 'set' : 'unset', baseUrl: BASE_URL, reachable: !reachabilityError, balance, reachabilityError, balanceError, ok: !reachabilityError && !balanceError };
}
