# V22 Coordinator Recovery Replay Design

## Goal

Prove that a restored coordinator thread can survive backend loss, reconnect into a history-gap state, and replay the last task in the same thread without losing its persisted workbench context.

## Why This Matters

The current product already proves three adjacent behaviors:

- coordinator starter runs can populate cards, timeline, and results
- completed coordinator threads can reload cleanly when runtime history is healthy
- active-thread recovery can preserve the shell and contextual retry affordances

What is still missing is the combined path that matters most for a durable local agent:

1. a coordinator thread already exists
2. backend becomes unavailable
3. reconnect succeeds, but runtime history for that thread is gone
4. user retries the last task from the same thread
5. coordinator surfaces recover again in-place

Without this proof, the deepest mixed scenario still depends on assumption instead of evidence.

## Scope

V22 is intentionally narrow:

1. add a browser regression for the coordinator recovery replay path
2. reuse persisted thread/workbench context instead of inventing a new recovery model
3. only change production code if the regression exposes a real bug

## Non-Goals

- No new coordinator architecture
- No redesign of the workbench UI
- No broader multi-tab or real external process orchestration
- No unrelated cleanup of existing E2E fixtures unless needed for this path

## Approach Options

### Option A: Add only another healthy reload regression

Pros:

- cheap
- low-risk

Cons:

- misses the actual recovery path
- duplicates V16 coverage

### Option B: Add a recovery replay regression for coordinator threads

Pros:

- covers the highest-value missing restart/resume path
- exercises the current product contract end-to-end
- exposes whether contextual retry really works for mixed coordinator surfaces

Cons:

- fixture setup is more involved

### Recommendation

Choose Option B.

The current gap is not “can coordinator reload when everything is healthy”; it is “can coordinator recover after history loss without ejecting the user from the thread.”

## Design

### Scenario

The regression should model this exact lifecycle:

1. seed a local active thread plus persisted coordinator workbench state
2. load the thread while backend is unreachable
3. verify the active-thread shell keeps timeline/results visible and exposes `Retry last task`
4. reconnect the backend, but return an empty/placeholder connect history so the app detects `thread_history_unavailable`
5. trigger `Retry last task`
6. return a deterministic coordinator run stream
7. verify the same thread renders the refreshed assistant output, coordinator cards, timeline tasks, and final summary

### Production-Code Expectation

The preferred outcome is that existing V20/V21 behavior already satisfies this scenario.

If the regression fails, only the smallest fix needed to preserve the current thread and replay flow should be added. Likely touch points would be:

- `web/src/app/page.tsx`
- `web/src/lib/thread-history-gap.ts`
- `web/src/lib/runtime-errors.ts`

### Testing Strategy

#### Browser

Add one Playwright regression that proves:

1. offline coordinator thread keeps workbench context visible
2. reconnect can transition into `thread_history_unavailable`
3. `Retry last task` replays inside the same thread
4. coordinator-specific surfaces recover after replay

#### Full Verification

- `npm --prefix web run typecheck`
- `npm --prefix web run test`
- `npm --prefix web run build`
- `npm --prefix web run e2e`
- `uv run --project agent pytest -v`

## Risks

- The connect-history fixture must be realistic enough to trigger the same client logic as the real runtime.
- Coordinator run fixtures should assert real user-facing surfaces, not just network calls.

## Verification Target

V22 is done when the repository has an explicit regression proving coordinator recovery replay in the same thread, and the full suite still passes.
