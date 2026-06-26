# V9 Retry Replay And Thread Recovery Design

## Problem

V8 fixed direct Python AG-UI route termination semantics, but the product-level recovery action `Retry last task` still depended too much on volatile in-memory agent state. That left a gap for refresh/reload and restored-thread recovery, especially for beginners who should be able to retry without manually retyping the last task.

## Goal

Make the product's recovery action deterministic by persisting the last runnable user prompt per thread and replaying it when the UI triggers recovery.

## Constraints

- Keep the existing CopilotKit runtime, route handler, and SQLite thread runner.
- Do not change beginner-facing recovery labels unless required by tests.
- Remain compatible with older local workbench snapshots that do not yet include a replay prompt field.

## Design

1. Extend `ThreadWorkbenchState` with `lastUserPrompt: string | null`.
2. Backfill older persisted workbench snapshots to `lastUserPrompt: null` during load.
3. Add a small frontend helper that:
   - extracts the latest user prompt from CopilotKit message history
   - avoids injecting a duplicate prompt when a pending run already has the same latest user message
4. Seed starter-template threads with their launch prompt so retry remains available even if the first run fails early.
5. Wire `retry_last_task` to use the stored prompt.
6. Prove the flow with a browser regression that restores a thread from local storage, raises a recoverable runtime event, retries, and verifies the stored prompt is sent again.

## Expected Outcome

- `Retry last task` works after refresh/reload from a restored thread.
- Recovery no longer relies on hidden runtime assumptions about message replay.
- Existing workbench snapshots remain loadable.
