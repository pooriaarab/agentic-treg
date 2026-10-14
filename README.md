# agentic-treg

[![npm version](https://img.shields.io/npm/v/agentic-treg)](https://www.npmjs.com/package/agentic-treg)
[![Downloads/month](https://img.shields.io/npm/dm/agentic-treg)](https://www.npmjs.com/package/agentic-treg)
[![MIT license](https://img.shields.io/npm/l/agentic-treg)](https://opensource.org/license/mit)

[Treg docs](https://treg.to/tutorial) · [API reference](https://treg.to/docs) · [llms.txt](https://treg.to/llms.txt) · [Package](https://www.npmjs.com/package/agentic-treg) · [Support](https://github.com/pooriaarab/agentic-treg/issues)

agentic-treg is an open-source Treg catalog client with endpoint discovery, call previews, a TypeScript API, CLI, and Model Context Protocol (MCP) server.

## Install

```sh
npm install agentic-treg
```

Use Node.js 18 or later. TypeScript declarations are included. The package has three direct runtime dependencies.
Use Node.js 20 or later for development.

## Preview your first call

```sh
npx agentic-treg call demo.endpoint --params '{"query":"hello"}'
```

Expect exit code 0 and this JSON:

```json
{"dryRun":true,"id":"demo.endpoint","params":{"query":"hello"},"maxCostUsd":1,"network":false}
```

This example requires no credentials or network access. `demo.endpoint` is a placeholder, not a verified catalog entry.
Preview confirms local parameter handling; it does not validate endpoint existence, price, or inputs.

```js
import { callEndpoint } from 'agentic-treg';
console.log(await callEndpoint('demo.endpoint', { query: 'hello' }));
```

## Features and coverage

- **Discovery:** Search the remote catalog and inspect endpoint methods, inputs, and published prices.
- **Preview:** Inspect call parameters without network access; execution requires an explicit live option.
- **Live calls:** Read endpoint details, dispatch the catalog method, and return charge headers when provided.
- **Diagnostics:** Report token status, service reachability, and organization balance.

| Integration | Status | Scope |
| --- | --- | --- |
| Treg (`https://treg.to`) | Implemented; live verification pending | Catalog, routed calls, organization balance, service metadata |

The code integrates with one remote service. It contains no provider registry or provider-specific adapters.
Catalog capabilities and prices come from Treg; this package does not establish a fixed coverage count.
Mocked tests and the local preview are verified. This campaign performs zero live credential checks.

## Runtime surfaces and limits

CLI commands: `search`, `get`, `call`, `balance`, `doctor`, `mcp`, `help`, and `version`.
Use `--help`/`-h` or `--version`/`-V` for those operations.
Start stdio MCP with `npx agentic-treg mcp` or `npx agentic-treg-mcp`.
MCP tools: `treg_search`, `treg_get`, `treg_call`, and `treg_doctor`.
Search, endpoint inspection, balance, and doctor make network requests. Only call previews are network-free.
Export `TREG_TOKEN` for authenticated requests; anonymous access depends on the service.
Set numeric `TREG_ORG_ID` when organization selection is ambiguous. The package does not load `.env` files.
Inspect `get <id>` before `call <id> --params '<JSON>' --live`; live calls can spend or change remote data.
SDK `callEndpoint` accepts `dryRun: false`, shared core `guards`, and `maxCostUsd` options.
The default ceiling is USD 1, sent as `X-Treg-Route-Max-Cost`; enforcement depends on Treg.
Published prices must be numeric and use USD when currency is specified.
Structured parameters accept `queryParams`, `pathParams`, and `body`; path parameters are forwarded as query fields.
Requests have a thirty-second timeout, reject redirects, and have no automatic retries.
Live-call data and CLI/MCP output are capped at 4,000 serialized UTF-8 bytes; oversized data becomes a text fragment.
Charge headers can be absent. The client does not supply its own billing ledger or idempotency key.
Error text replaces exact occurrences of the configured token; this does not guarantee redaction of every secret format.
## Status and development

Version 0.1.0 is an early release; APIs can change before 1.0. Public case studies are not yet published.
Use [GitHub issues](https://github.com/pooriaarab/agentic-treg/issues) for support and [Treg](https://treg.to) for service information.
For development, run `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, then `npm pack`.
## License

MIT.
