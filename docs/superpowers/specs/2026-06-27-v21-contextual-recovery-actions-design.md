# V21 Contextual Recovery Actions Design

## Goal

Make recoverable error actions context-aware so active-thread failures can offer a direct `Retry last task` path instead of forcing beginners to manually reconstruct their next step.

## Why This Matters

The product already has the raw ingredients:

- `lastUserPrompt` persistence in workbench state
- reconnect/bootstrap recovery
- active-thread shell preservation

But recoverable actions are still mostly static by error code. In the most common in-thread failure case:

- backend goes unreachable
- user still sees the thread shell
- user still has a retryable last task

Yet the UI only offers `Retry connection`, `View diagnostics`, and `Open settings`.

That means the user must remember or retype the last task after recovery, even though the app already knows it.

## Scope

V21 adds one focused behavior:

1. In active-thread recovery contexts that still have a retryable last task, show `Retry last task` alongside other recovery actions.

## Non-Goals

- No auto-run without an explicit user action.
- No new persistence model.
- No redesign of recoverable notices or diagnostics.
- No generalized workflow engine for every action combination.

## Approach Options

### Option A: Keep recovery actions static by error code

Pros:

- Simpler helper signatures

Cons:

- Misses thread context
- Leaves product intelligence on the table

### Option B: Make recovery actions context-aware when rendering

Pros:

- Reuses existing stored prompt and in-thread retry flow
- Preserves simple defaults for onboarding/gate contexts
- Improves the most important in-thread failure path

Cons:

- Requires small API evolution in the action resolver

### Recommendation

Choose Option B.

Static defaults are still fine, but the rendered action list should be allowed to use thread context when it exists.

## Design

### Context Contract

Extend recoverable action resolution to optionally accept:

- `hasActiveThread`
- `hasRetryableTask`

Rules:

- `backend_unreachable`
  - default: `Retry connection`, `View diagnostics`, `Open settings`
  - with retryable active thread: prepend or append `Retry last task`
- other in-thread recoverable failures can keep their current action sets unless the product already includes retry

This keeps the change focused on the most common gap.

### Behavior

When the user clicks `Retry last task` during backend-unreachable recovery:

1. if runtime is still unavailable, keep the user inside the active thread shell
2. once runtime reconnects, the same thread can still expose `Retry last task`
3. when the user clicks `Retry last task` again after reconnect, the stored prompt replays in-thread

V21 makes that recovery path explicit instead of forcing the user to remember or retype the previous task.

## Testing Strategy

### Unit

Add tests proving backend-unreachable actions differ by context:

- no active thread => no retry-last-task button
- active thread + retryable task => includes retry-last-task

### Browser

Add one regression that proves:

1. active thread loads in backend-unreachable state
2. notice shows `Retry last task`
3. user clicks `Retry last task`
4. user clicks `Retry connection`
5. active thread stays recoverable after reconnect
6. user can click `Retry last task` in-thread and receive a fresh response

## Risks

- Exposing retry in gate-style contexts with no stored task would be confusing.
- Action ordering should stay predictable so the new retry button does not hide the more fundamental reconnect path.

## Verification

- Focused:
  - `npm --prefix web run test -- src/lib/__tests__/runtime-errors.test.ts`
  - `npm --prefix web run e2e -- queued-retry-after-reconnect.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
