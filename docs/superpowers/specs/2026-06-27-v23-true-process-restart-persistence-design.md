# V23 True Process Restart Persistence Design

## Goal

Prove that a completed local thread still restores correctly after a real web-process restart, even when the backend preset catalog and agent stream are no longer reachable.

## Why This Matters

The current repository already proves adjacent pieces:

- runtime-level SQLite restore across fresh runtime instances
- route-level restore after a module reload with cached preset catalog fallback
- browser-level continuity and recovery for mocked reconnect and history-gap flows

What is still missing is a real process boundary proof for the production-facing web runtime itself. Today we still rely on inference for the question that matters operationally:

1. a real Next.js process serves the app
2. a real backend process provides presets and run streams
3. a user completes a thread
4. the services go away
5. a fresh Next.js process comes back without a live backend
6. the same thread should still reopen from SQLite and cached catalog state

If that fails, the product can look durable in lower-level tests while still breaking at the actual service boundary.

## Scope

V23 is intentionally narrow:

1. add a dedicated process-managed route regression that manages its own web and backend processes
2. use the real app, real `next start`, real `[[...slug]]` runtime route, real SQLite thread store, and real cached preset catalog file
3. use a deterministic stub backend process so the test stays offline and reproducible
4. prove restore after stopping the backend and restarting the web process

## Non-Goals

- No production feature redesign
- No new persistence format
- No expansion into coordinator-specific replay in this phase
- No dependency on external model providers
- No broad replacement of the existing Playwright suite

## Approach Options

### Option A: Add another module-level Vitest restore case

Pros:

- minimal code
- fast

Cons:

- duplicates V12/V13 confidence
- still avoids the real process boundary

### Option B: Add a dedicated process-managed route regression

Pros:

- proves the real service boundary
- exercises the actual runtime route through a real production web process
- keeps the backend deterministic and restartable

Cons:

- needs helper scripts for process lifecycle and readiness polling

### Option C: Replace the whole main Playwright harness with process-managed startup

Pros:

- one unified strategy

Cons:

- larger churn
- unnecessary risk for a single missing proof

### Recommendation

Choose Option B.

The gap is specific: we need one explicit proof that a fresh web process can restore a real thread from disk when the backend disappears. A dedicated harness closes that gap without destabilizing the existing suite.

## Design

### Test Topology

The new regression should run in its own Playwright config instead of reusing the default `webServer` setup.

It should manage:

- one stub backend process on a dedicated port
- one production `next start` web process on a dedicated port
- one isolated temp directory containing:
  - `threads.db`
  - `runtime-catalog.json`

### Stub Backend Contract

The restartable backend process only needs to serve the surfaces the app actually uses in this flow:

- `GET /presets`
- `GET /health`
- `GET /config`
- `POST /openai-balanced`

The run endpoint should emit a deterministic AG-UI text stream with:

- user prompt capture
- assistant reply
- successful run completion

### Lifecycle Under Test

1. start stub backend
2. start `next start` with env pointing to the stub backend and isolated persistence files
3. call the real `run` route and assert the first assistant response finishes successfully
4. stop the backend process
5. stop the web process
6. start a fresh web process with the same SQLite and catalog paths
7. assert `runtime-diagnostics` now reports `degraded + fallback`
8. call the real `connect` route
9. assert the persisted user prompt and assistant response restore from SQLite without a live backend

### Files

- new helper module for spawning, waiting, and stopping child processes
- new stub backend script
- new dedicated Playwright config for the restart proof
- new Playwright spec for the process-restart route-restore scenario

### Product Expectation

After a successful first run, a fresh web process with the same persisted files must be able to:

- load the preset catalog from the cached file
- construct the runtime route
- restore the existing thread history from SQLite
- return the restored assistant transcript through the runtime route

The product must not:

- drop the user back to the onboarding gate
- misclassify the thread as missing history
- require the backend to be live just to reopen an already-completed thread

## Risks

- Process readiness polling must be explicit or the regression will flap.
- Child-process shutdown must be defensive so local machines do not accumulate orphaned `node` processes.
- The stub backend must match the exact route shapes the app currently consumes; otherwise the test would validate the fixture instead of the product.

## Verification

- Focused:
  - `npm --prefix web run e2e:process-restart`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
