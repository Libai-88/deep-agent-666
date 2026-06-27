# V24 Coordinator True Process Restart Design

## Goal

Prove that a completed coordinator thread still restores correctly after a real web-process restart, even when the backend preset catalog and coordinator endpoint are no longer reachable.

## Why This Matters

The current repository now has strong adjacent coverage:

- coordinator browser continuity after reload in mocked healthy conditions
- coordinator recovery replay after mocked reconnect and history-gap
- single-agent true web-process restart restore through the real production runtime route

What is still missing is the same real process-boundary proof for the coordinator path. Today the product depends on inference for a critical mixed scenario:

1. a real production `next start` process serves the app
2. a coordinator run completes and persists runtime thread history
3. the backend and web process both disappear
4. a fresh web process comes back with the same SQLite thread store and cached preset catalog
5. the coordinator thread should still restore from disk without a live backend

Without this proof, the riskiest restart/resume path for the beginner-friendly engineering flow remains partially assumed.

## Scope

V24 is intentionally narrow:

1. extend the dedicated process-managed restart harness introduced in V23
2. run the real coordinator route through a real production `next start` process
3. persist and restore through the same SQLite thread store and cached preset catalog file
4. assert degraded diagnostics plus coordinator thread restoration after backend loss and web restart

## Non-Goals

- No new coordinator architecture
- No full browser workbench continuity orchestration in this phase
- No new persistence format
- No attempt to replay tool-call cards on `connect` if the runtime only restores message history
- No broader refactor of the existing E2E harness

## Approach Options

### Option A: Only add another mocked browser continuity regression

Pros:

- cheap
- similar to existing coordinator tests

Cons:

- does not cross the real process boundary
- duplicates V16/V22 confidence more than it closes the remaining gap

### Option B: Add a dedicated coordinator process-restart route regression

Pros:

- closes the remaining P1 proof at the production runtime boundary
- reuses the now-stable V23 harness pattern
- keeps the test deterministic and offline-safe

Cons:

- does not prove browser-local workbench state continuity by itself

### Option C: Jump straight to full browser coordinator continuity under real process restart

Pros:

- highest fidelity

Cons:

- substantially more moving parts
- higher flake risk
- harder to keep as a stable baseline right now

### Recommendation

Choose Option B.

The immediate gap is not “can the browser repaint coordinator surfaces after restart”; it is “can the real production runtime route restore a persisted coordinator thread after real process restart.” That is the highest-value missing proof with the best stability/cost tradeoff.

## Design

### Test Topology

Reuse the dedicated Playwright config from V23 rather than the shared `webServer` harness.

The regression should manage:

- one restartable stub backend process
- one production `next start` process on a dedicated port
- one isolated temp directory containing:
  - `threads.db`
  - `runtime-catalog.json`

### Coordinator Backend Contract

The stub backend already serves the needed surfaces:

- `GET /presets`
- `GET /health`
- `GET /config`
- `POST /coordinator-openai-balanced`

The coordinator route should emit a deterministic stream containing:

- planner / executor / reviewer tool calls
- state snapshots with `delegations`
- a final assistant summary
- successful terminal event

### Lifecycle Under Test

1. start stub backend
2. start `next start` with env pointing to the stub backend and isolated persistence files
3. call the real coordinator `run` route and assert the planner/executor/reviewer stream completes successfully
4. stop the backend process
5. stop the web process
6. restart the web process with the same SQLite and catalog paths
7. assert `runtime-diagnostics` now reports `degraded + fallback`
8. call the real coordinator `connect` route
9. assert the persisted user prompt and assistant summary restore from SQLite without a live backend

### Files

- modify the V23 process-restart spec so it covers both single-agent and coordinator restore paths
- keep the existing process-control helper and restartable backend stub
- update docs and status baselines to reflect the new coordinator restart proof

### Product Expectation

After a successful coordinator run, a fresh web process with the same persisted files must be able to:

- load the cached preset catalog
- reconstruct the runtime route without a live backend
- restore the persisted coordinator thread from SQLite
- return the restored prompt and assistant summary through the coordinator `connect` route

The product must not:

- require the backend to be live just to reopen an already-completed coordinator thread
- silently lose the persisted coordinator transcript after web restart
- regress diagnostics to a misleading healthy state

## Risks

- `connect` restoration may only replay user/assistant messages, not tool-call frames; the test must assert what the runtime actually promises.
- The dedicated restart harness must stay isolated from the shared Playwright suite or the process lifecycle will become flaky.
- The stub backend fixture must remain aligned with the coordinator surface the app currently builds from `/presets`.

## Verification

- Focused:
  - `npm --prefix web run e2e:process-restart`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
