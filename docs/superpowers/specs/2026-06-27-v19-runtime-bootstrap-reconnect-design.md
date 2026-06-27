# V19 Runtime Bootstrap Reconnect Design

## Goal

Ensure that when the local backend recovers after being unreachable, the current browser tab can re-bootstrap CopilotKit and continue the product flow without a manual page reload.

## Why This Matters

V18 made runtime health visible and refreshable, but visibility alone is not enough. There is still a likely continuity gap:

- the page can refresh preset state and diagnostics
- the header can show a healthier runtime status
- starter templates can become visible again

But if the root `Providers` wrapper still thinks CopilotKit is unavailable, the runtime bridge may remain unmounted in that tab. A beginner then sees a recovered UI shell but still cannot actually launch or continue work reliably.

That is a product continuity bug, not just a diagnostics gap.

## Scope

V19 covers three concrete outcomes:

1. Recovery actions that imply runtime availability changes also trigger a root CopilotKit bootstrap refresh.
2. The bootstrap refresh path becomes observable enough to test deterministically.
3. Browser regression proves an offline tab can recover to a working starter-run flow without a full reload.

## Non-Goals

- No backend auto-restart.
- No desktop process supervisor.
- No cross-tab synchronization.
- No new diagnostics taxonomy beyond the existing V18 status model.

## Approach Options

### Option A: On recovery, only refresh page-local state

Pros:

- Minimal code changes

Cons:

- Leaves the root CopilotKit provider potentially stale
- Risks a false “healthy” shell with no real runtime mount

### Option B: Treat runtime recovery as both state refresh and provider bootstrap refresh

Pros:

- Aligns visible runtime status with actual runtime readiness
- Reuses the existing bootstrap-refresh event channel
- Small surface area

Cons:

- Requires slightly tighter coordination between `page.tsx` and `Providers`

### Recommendation

Choose Option B.

The product should not say “healthy” unless the tab has also had a chance to remount the runtime bridge.

## Design

### Recovery Flow Contract

The following actions should trigger a full runtime refresh sequence:

- `retry_connection`
- diagnostics dialog refresh
- any other recovery action whose purpose is “the backend may be back now”

That sequence should:

1. refresh preset-state
2. refresh runtime settings
3. refresh runtime diagnostics
4. request root bootstrap refresh
5. wait for bootstrap readiness before claiming recovery is done

### Providers Behavior

The `Providers` wrapper already listens for `deep-agent-666.runtime-bootstrap-refresh`. V19 should keep that event channel as the single re-bootstrap path.

The page-level recovery helpers should call it consistently instead of relying on Settings save as the only bootstrap trigger.

### Testability

We need a browser regression that proves all the way through to a real first guided run:

1. start offline with configured provider state
2. recover runtime endpoints in-place
3. trigger `Retry connection`
4. see starter templates return
5. launch starter task successfully in the same tab
6. receive the assistant response

This is stronger evidence than only checking a status badge.

## Risks

- If refresh ordering is sloppy, the page can race and show starter UI before the provider is mounted.
- If bootstrap refresh is overused, harmless state refreshes may become noisier than needed.
- If the ready event never fires, recovery actions must still fail soft instead of hanging forever.

## Verification

- Focused:
  - `npm --prefix web run e2e -- runtime-reconnect-recovery.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
