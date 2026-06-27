# V25 Coordinator Browser Restart Continuity Design

## Goal

Prove, at the browser level, that a completed coordinator thread still reopens cleanly after a real production web-process restart while the backend remains offline.

## Why This Matters

The current repository now has two strong but separate guarantees:

- mocked browser continuity for coordinator reload and recovery flows
- real process-boundary restart proofs for both the single-agent route and the coordinator route

What is still missing is the product-level proof that combines them:

1. a beginner launches a real coordinator task in the browser
2. the workbench persists timeline and summary locally
3. the backend and web process both disappear
4. a fresh `next start` process comes back with the same SQLite and cached catalog files
5. the same browser context should reopen the thread with restored chat plus persisted workbench surfaces

Until that is proven, the product can be technically durable at the route boundary while the actual beginner-visible shell remains partially assumed.

## Scope

V25 is intentionally narrow:

1. reuse the dedicated V23/V24 process-managed Playwright harness
2. drive the real browser UI instead of request-only route calls
3. start from the existing engineering starter flow so the thread is a real completed coordinator session
4. restart the real `next start` process with the backend offline
5. assert restored chat, persisted timeline/results, and degraded diagnostics in the browser

## Non-Goals

- No new runtime persistence format
- No full recovery replay after restart in this phase
- No additional coordinator architecture changes
- No attempt to restore tool-call cards in the chat transcript if `connect` only replays user/assistant messages
- No broader overhaul of the dedicated process-restart harness

## Approach Options

### Option A: Add only another route-level restart proof

Pros:

- cheapest change
- reuses the already-stable harness

Cons:

- does not improve beginner-visible product evidence
- duplicates V23/V24 confidence rather than closing the remaining gap

### Option B: Add a browser-level coordinator continuity proof on top of the real restart harness

Pros:

- highest-value missing product proof
- reuses the stable startup/teardown harness from V23/V24
- validates the real shell behavior a beginner actually sees

Cons:

- more moving parts than request-only tests
- assertions must be chosen carefully to avoid depending on tool-call replay over `connect`

### Option C: Expand directly to restart + history-gap + replay in one browser scenario

Pros:

- deepest coverage

Cons:

- too much scope in one phase
- mixes healthy continuity and recovery replay into one fragile path

### Recommendation

Choose Option B.

The missing evidence is not “can the backend restore coordinator state” anymore. It is “does the real browser shell remain understandable after an actual restart.” Option B closes that gap without overloading the scenario.

## Design

### Harness Strategy

Reuse the dedicated process-restart Playwright config and helpers:

- restartable stub backend
- production `next start`
- isolated SQLite thread database
- isolated cached preset catalog file

The browser test should stay in the same dedicated suite as V23/V24 rather than moving into the shared `webServer` harness.

### Lifecycle Under Test

1. start stub backend
2. start `next start` with isolated persistence paths
3. open the real browser UI
4. launch the engineering starter so a coordinator thread completes
5. assert first-session workbench surfaces are visible:
   - assistant summary message in chat
   - timeline tasks
   - a readable results panel with coordinator summary artifacts
6. stop backend
7. stop web
8. restart only the web process with the same persistence files
9. revisit the same origin in the same browser context
10. assert the restored thread opens without recovery warnings and keeps the persisted workbench readable
11. assert diagnostics degrade to `Degraded` rather than silently resetting the app

### Assertion Contract

The browser proof should assert only what the product actually guarantees after `connect`:

- restored assistant message is visible
- `Thread history unavailable` does not appear
- starter gate does not reappear
- persisted timeline tasks are still visible from local workbench state
- results panel remains populated and readable for the restored coordinator outcome
- runtime status badge shows `Degraded`

It should not require:

- replayed tool-call cards in the transcript
- a live backend
- a new run after restart

### Files

- modify `web/tests/e2e/true-process-restart-persistence.spec.ts`
- keep `web/tests/e2e/helpers/process-control.ts`
- keep `web/tests/e2e/helpers/restartable-backend.mjs`
- update docs/status baseline after the proof is green

## Risks

- Browser waiting must be condition-based rather than `networkidle`, because `connect` keeps long-lived streaming requests open.
- The coordinator browser proof depends on localStorage continuity in the same Playwright context; restarting services must not reset browser state.
- The assertions must remain aligned with what the runtime restores on `connect`, not with what the initial live run rendered through tool-call events.

## Verification

- Focused:
  - `npm --prefix web run e2e:process-restart`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
