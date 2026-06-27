# V20 Active Thread Recovery Shell Design

## Goal

Keep the current thread shell visible when a recoverable runtime/backend error happens, so beginners do not lose access to their local timeline, artifacts, and thread context during recovery.

## Why This Matters

The product already has durable local thread state:

- thread list
- task timeline
- artifact/results panel
- last runnable prompt
- runtime diagnostics

But the current first-run state resolver still collapses any recoverable runtime error into the onboarding gate, even when the user already has an active local thread.

That means a beginner can:

- lose sight of the current thread’s context
- lose immediate access to persisted timeline/results
- be redirected to a generic gate instead of recovering in place

This is a continuity regression for thread-based work.

## Scope

V20 changes one product rule:

1. If a valid local active thread exists and the error is runtime-recoverable, keep the main workbench shell visible and show the recoverable notice in-context.

## Non-Goals

- No new recovery taxonomy.
- No redesign of the onboarding gate.
- No change to invalid-thread or no-preset cases.
- No process-management or auto-restart behavior.

## Approach Options

### Option A: Keep current gate behavior for all errors

Pros:

- Simple mental model

Cons:

- Throws away useful local thread context
- Makes recovery feel like starting over

### Option B: Preserve the active thread shell for recoverable runtime failures

Pros:

- Keeps local context visible
- Lets the user recover in the place where work was happening
- Reuses the existing workbench notice UI

Cons:

- Requires one small distinction between onboarding errors and in-thread runtime errors

### Recommendation

Choose Option B.

When the user already has a thread, recovery should happen in-thread unless the thread itself is invalid.

## Design

### Error Classes That Preserve The Shell

If there is a valid local active thread, preserve the workbench shell for:

- `backend_unreachable`
- `configuration_failed`
- `workspace_root_invalid`
- `thread_history_unavailable`
- `provider_rate_limited`
- `provider_model_unavailable`
- `provider_access_denied`
- `provider_auth_failed`
- `runtime_request_failed`

Do not preserve the shell for:

- `no_available_presets`
- `thread_missing_or_invalid`

Those still belong to gate-style recovery because the product either has no runnable presets or the selected thread cannot be trusted.

### UI Behavior

With an active thread and a preservable error:

- keep the thread shell mounted
- keep timeline/results panels visible
- show the existing `WorkbenchStatusNotice`
- keep thread actions and recovery buttons available

This turns recovery from “leave the workspace” into “recover inside the workspace.”

## Testing Strategy

### Unit

Expand first-run-state tests to prove:

- active thread + backend/runtime failure => `ready-active-thread`
- active thread + invalid thread error => `recoverable-error`

### Browser

Add one regression that proves:

1. stored active thread exists with persisted workbench state
2. backend is unreachable
3. page keeps timeline/results visible instead of falling back to the onboarding gate
4. after retry connection, the same thread shell remains available

## Risks

- Preserving the shell for too many errors could hide truly broken thread identity issues.
- The page must still avoid rendering a fake active thread when the selected thread is invalid.

## Verification

- Focused:
  - `npm --prefix web run test -- src/lib/__tests__/first-run-state.test.ts`
  - `npm --prefix web run e2e -- active-thread-recovery-shell.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
