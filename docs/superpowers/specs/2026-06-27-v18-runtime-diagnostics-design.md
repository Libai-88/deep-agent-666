# V18 Runtime Diagnostics Design

## Goal

Make local runtime health visible and actionable for beginners by exposing a single in-product diagnostics surface that explains whether the backend is healthy, merely cached, needs setup, or is fully offline.

## Why This Matters

The product already handles several recoverable runtime failures:

- backend unreachable
- provider auth / rate-limit / model mismatch
- thread history gaps and drift
- starter-task recovery

But those states are still mostly explained through one-off banners and gate copy. A beginner can see that something failed, yet still cannot quickly answer:

- Is the backend process reachable right now?
- Am I looking at live presets or only cached fallback data?
- Do I have any launchable presets at all?
- Which providers are configured?
- Which workspace root is active?

That makes local troubleshooting too dependent on guesswork.

## Scope

V18 adds one coherent product surface:

1. A same-origin runtime diagnostics route that aggregates backend health, preset-state source, and runtime config.
2. A normalized frontend diagnostics model with explicit status buckets.
3. A header status badge and a lightweight diagnostics dialog.
4. A recovery action that opens diagnostics directly from onboarding and runtime error states.

## Non-Goals

- No process management or auto-restart of the backend.
- No desktop-only OS integrations.
- No deep per-agent telemetry, token accounting, or streaming trace inspection.
- No replacement of the existing settings dialog or recoverable-error model.

## Approach Options

### Option A: Keep only banner copy and add more prose

Pros:

- Very small code change
- Reuses current error flows

Cons:

- Still forces users to infer state from scattered messages
- Does not create a single trusted runtime snapshot

### Option B: Add one aggregated diagnostics contract and surface it in-product

Pros:

- Creates one source of truth for user-facing runtime state
- Reuses existing `/health`, `/config`, and preset-state endpoints
- Gives both onboarding and active-thread flows the same debugging language

Cons:

- Requires a small new route, state model, and UI surface

### Recommendation

Choose Option B.

This is the smallest change that materially improves newcomer operability without inventing a heavier monitoring system.

## Diagnostics Contract

The new same-origin route should return a normalized payload with:

- `status`: `healthy | setup-required | degraded | offline`
- `backendReachable`: boolean
- `catalogSource`: `live | fallback`
- `launchablePresetCount`: number
- `configuredProviderCount`: number
- `workspaceRoot`: string | null
- `providers`: configured/baseUrl snapshot for OpenAI, Anthropic, Google
- `checkedAt`: ISO timestamp

### Status Rules

- `healthy`
  - backend reachable
  - live preset catalog available
  - at least one launchable preset
- `setup-required`
  - backend reachable
  - zero launchable presets
- `degraded`
  - fallback catalog is in use, or runtime/backend signals only partial availability
- `offline`
  - backend unreachable and no launchable catalog can be trusted for a fresh run

This keeps the status model small and understandable.

## UI Design

### Header Surface

Add a compact badge in the header that always shows the current runtime status:

- Healthy
- Setup required
- Degraded
- Offline

The badge should stay readable but low-noise. It is not an error toast.

### Diagnostics Dialog

Clicking the badge opens a small dialog with:

- backend reachability
- preset catalog source
- launchable preset count
- configured providers
- active workspace root
- a refresh button

This creates one place where users can inspect the state before reopening Settings or retrying a task.

### Recovery Integration

Existing first-run gates and workbench notices should gain a `View diagnostics` action for failures where runtime visibility matters, especially:

- backend unreachable
- runtime request failed
- provider-side runtime failures

The action opens the same dialog instead of adding another custom branch.

## Data Flow

1. Page boot requests `/api/runtime-diagnostics`.
2. The route queries existing same-origin/backend-facing endpoints and normalizes the result.
3. The page stores the diagnostics snapshot in state.
4. Header badge and dialog read from the shared snapshot.
5. Retry / settings-save flows re-fetch diagnostics so the UI reflects the latest runtime state.

## Testing Strategy

### Unit

Add normalization tests for status classification:

- healthy live runtime
- setup-required with zero presets
- degraded fallback snapshot
- offline backend failure

### Route

Add route tests that mock backend fetch responses and prove the aggregated payload shape.

### Browser

Add one Playwright regression that proves:

1. offline onboarding shows a diagnostics entrypoint
2. opening diagnostics exposes backend, catalog, preset, and workspace details
3. refreshing diagnostics can move the badge/dialog back to a healthier state when the mocked route recovers

## Risks

- If the route classifies fallback/offline too aggressively, the UI may overstate a failure.
- Diagnostics state can drift from catalog state if refreshes are not wired into the same save/retry paths.
- The header badge must stay compact enough not to crowd the existing controls.

## Verification

- Focused:
  - `npm --prefix web run test -- src/lib/__tests__/runtime-diagnostics.test.ts src/app/api/runtime-diagnostics/route.test.ts src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx`
  - `npm --prefix web run e2e -- runtime-diagnostics.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
