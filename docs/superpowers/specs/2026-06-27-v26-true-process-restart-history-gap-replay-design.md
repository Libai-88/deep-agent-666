# V26 True Process Restart History-Gap Replay Design

## Problem

V25 proved that a completed coordinator thread can reopen cleanly after a real production `next start` restart while the backend stays offline, as long as the runtime SQLite history still exists.

The next high-value gap is the harsher disaster-recovery path: the browser still has the local thread and workbench context, the runtime catalog can still bootstrap from cache, but the runtime thread database is gone after a real restart. In that state the product must do more than reopen old UI. It must clearly surface the missing runtime history and still let the user recover in the same thread once the backend comes back.

## Goal

Prove, at the browser level, that a coordinator thread can survive this sequence:

1. complete a real task
2. stop the backend and web process
3. restart the web process with the same cached runtime catalog but a different empty SQLite thread store
4. show `Thread history unavailable` while preserving the local workbench shell
5. bring the backend back
6. replay the last task in the same thread
7. confirm the thread now has fresh runtime history again

## Non-Goals

- No automatic backend restart
- No new recovery surface beyond the existing `Thread history unavailable` and `Retry last task` flow
- No broader refactor of the process-restart harness
- No expansion into multiple new providers or non-coordinator variants in this phase

## Options

### Option A: Add another request-level restart proof

Extend the existing request-driven restart suite and assert that `connect` fails before replay, then succeeds after replay.

Pros:

- Cheap to add
- Stable and fast

Cons:

- Misses the product shell entirely
- Does not prove that a real user sees the correct recovery notice and can trigger replay from the UI

### Option B: Add a browser-level process-restart history-gap and replay proof

Reuse the V23-V25 process-managed harness, keep the browser context alive, intentionally swap to a fresh SQLite store on restart, assert the history-gap notice, bring the backend back, replay in the same thread, and finally verify runtime history is repopulated.

Pros:

- Covers the riskiest remaining mixed recovery path
- Exercises the exact user-visible recovery loop
- Builds directly on existing runtime, workbench, and restart infrastructure

Cons:

- More moving pieces than a pure request-level proof
- Can expose timing issues around history-gap detection and replay completion

### Option C: Add production auto-repair when thread history is missing

Change the app to silently create a new runtime thread or auto-run the last prompt when the history gap is detected.

Pros:

- Could reduce manual recovery steps

Cons:

- Changes product semantics
- Risks surprising duplicate runs
- Expands scope far beyond proof-driven hardening

## Recommendation

Choose Option B.

The main remaining uncertainty is not whether the product can repaint persisted UI, and not whether request-level persistence still works. It is whether the real browser shell can guide the user through a genuine runtime-history loss after a real restart and successfully recover within the same thread. Option B proves that path without inventing new product behavior.

## Design

### Scenario

Use the dedicated process-restart Playwright suite and extend `web/tests/e2e/true-process-restart-persistence.spec.ts` with one coordinator-focused browser test:

1. start the restartable stub backend
2. start `next start` against `threads.db A` and `runtime-catalog.json`
3. run the real coordinator starter flow in the browser and assert the initial assistant/timeline/results state
4. stop backend
5. stop web
6. restart web against `threads.db B` while reusing the same cached runtime catalog
7. reload the page in the same browser context
8. assert:
   - `Thread history unavailable` is visible
   - persisted local workbench timeline/results are still visible
   - degraded runtime status is visible
9. restart backend
10. click `Retry last task`
11. assert:
   - the assistant completes in the same thread
   - the history-gap notice disappears
   - refreshed coordinator workbench surfaces are still aligned
12. call the real `connect` route and verify the new SQLite store now contains runtime history for that same thread

### Expected Product Contract

- The app must not silently reset to the starter gate when local thread context exists.
- The app must surface `Thread history unavailable` after the restarted runtime returns an empty history for a thread that still has restorable local context.
- `Retry last task` must still target the same thread and reuse the persisted last user prompt.
- Once the backend is back, replay must repopulate runtime history so subsequent restore reads from the new runtime store instead of only local workbench state.

### Likely Code Impact

- Primary change should be in `web/tests/e2e/true-process-restart-persistence.spec.ts`
- If the proof exposes a real product gap, the likely fix area is `web/src/app/page.tsx` or the small recovery helpers in `web/src/lib`
- Restartable backend helpers can stay as-is unless the replay proof needs a deterministic extra assertion

## Risks

- The history-gap notice is timer-driven, so the test must use condition-based waits instead of brittle `networkidle` assumptions.
- Replaying too early, before the backend is back, can convert the state into a different recoverable error and blur the assertion target.
- The proof must distinguish “persisted local workbench still visible” from “runtime history has actually been repopulated”; that is why the final `connect` assertion matters.

## Test Plan

- `npm --prefix web exec playwright test --config playwright.process-restart.config.ts --grep "history-gap"`
- `npm --prefix web run test -- --runInBand false`
- `npm --prefix web run e2e:process-restart`
- Final full verification before commit:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`

## Why This Phase Matters

This closes the last obvious trust gap in the V1 local-first recovery story. After V26, the product will not only prove that completed threads survive real restarts when persistence remains intact, but also that users can recover coherently when the runtime history itself was lost and must be rebuilt in place.
