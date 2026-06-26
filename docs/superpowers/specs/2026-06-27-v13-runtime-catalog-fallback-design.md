# V13 Runtime Catalog Fallback Design

## Problem

V12 proved that the CopilotKit runtime can restore finished threads from SQLite across runtime instances. But the actual `[[...slug]]` route still depends on a fresh `/presets` fetch to rebuild its agent registry. If that fetch fails after a restart, the route falls back to an empty catalog, which can make persisted threads unrecoverable even though the message history is still present in SQLite.

## Goal

Preserve the last known runtime catalog locally so the main CopilotKit route can continue restoring persisted threads when the live preset catalog is temporarily unavailable.

## Constraints

- Keep the existing `source: "live" | "fallback"` contract.
- Do not weaken live behavior: a successful live fetch remains authoritative.
- Keep the implementation local-first and file-backed, consistent with the SQLite thread store.
- Make the regression proof hit the real `web/src/app/api/copilotkit/[[...slug]]/route.ts` entrypoint.

## Design

1. Add a small file-backed runtime catalog cache on the web server side.
2. When `loadRuntimeCatalog(baseUrl)` gets a live catalog, normalize it and persist it to the cache path.
3. When the live fetch throws, attempt to read the cached catalog instead of always returning an empty catalog.
4. Keep the response source as `"fallback"` when cache is used, so the UI still knows the result is not live.
5. Add a real route-level integration test that:
   - runs a thread through `[[...slug]]`
   - resets modules to simulate route/runtime recreation
   - makes `/presets` unavailable
   - verifies `/agent/openai-balanced/connect` still restores the prior user prompt and assistant reply from SQLite
   - verifies restore does not call the remote agent backend again

## Expected Outcome

- A temporary `/presets` outage no longer erases the route-level agent registry for already-known presets.
- Persisted beginner threads remain recoverable through the product’s real runtime route, not only through lower-level runtime assembly helpers.
- The remaining restart/resume gap narrows further toward broader multi-entry and full process-restart validation.
