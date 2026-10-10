# agentic-treg

Route live data through a catalog with a CLI, npm library, and MCP server.

```sh
npm install agentic-treg
```

Preview a call without network access.

```sh
npx agentic-treg call treg.web.extract --params '{"url":"https://example.com"}'
```

## Usecases

1. Find an endpoint for a data request.
2. Inspect parameters and price before a call.
3. Route a live request and read its charge.

## CLI

Search the free catalog.

```sh
npx agentic-treg search "search results" --dry-run
npx agentic-treg get treg.web.extract
npx agentic-treg doctor
npx agentic-treg balance
```

Search performs a free catalog lookup even with `--dry-run`.
Calls default to previews with no network access.
Set `TREG_TOKEN` for authenticated access.
Omit it for anonymous access where allowed.
The service may refuse anonymous calls.
Set `TREG_ORG_ID` when balance discovery finds multiple organizations.
Run `doctor` to read token status, reachability, and balance errors.
Doctor exits with failure when any check fails.

Pass `--live` to execute a call.
Live calls fetch endpoint details before spending.
The default live ceiling is one dollar per call.
The response includes the published price and charged microdollars.

```sh
npx agentic-treg call treg.web.extract --params '{"url":"https://example.com"}' --live
```

## Library

```js
import { searchCatalog, getEndpoint, callEndpoint, getBalance, doctor } from 'agentic-treg';

await searchCatalog('search results');
await getEndpoint('treg.web.extract');
await callEndpoint('treg.web.extract', { url: 'https://example.com' });
await callEndpoint('treg.web.extract', { url: 'https://example.com' }, { dryRun: false, maxCostUsd: 0.1 });
await getBalance();
await doctor();
```

Pass plain parameters for simple queries or JSON bodies.
Pass `{ queryParams, pathParams, body }` for mixed inputs.
Read endpoint details to choose the correct input shape.
Live calls use the catalog method.
Results retain up to 4000 UTF-8 bytes of custom data.
Oversized data becomes a text fragment with `truncated: true`.
HTTP and vendor failures throw `VendorError` from the shared core.
Pass core guards through the library call options.
A denied guard prevents all network activity.

## MCP

```sh
npx agentic-treg mcp
```

Use `agentic-treg-mcp` as the dedicated stdio entry.
Call `treg_search`, `treg_get`, `treg_call`, or `treg_doctor`.
Set `live: true` explicitly to execute `treg_call`.
The call tool declares destructive behavior because endpoints may write data.

## Defaults

Use Node 18 or newer.
Requests time out after thirty seconds.
Requests reject redirects and perform no automatic retries.
Balance discovery selects only a single available organization.
Tokens never appear in diagnostics.
The catalog controls available capabilities and prices.

## Development

Use Node 20 or newer for development.

```sh
npm ci
npm run build
npm run typecheck
npm test
npm pack
```

MIT license.
