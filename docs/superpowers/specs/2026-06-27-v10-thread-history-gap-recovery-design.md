# V10 Thread History Gap Recovery Design

## Problem

V9 made `Retry last task` restart-safe from the product side, but the app still had a blind spot: a local thread could remain visible while the runtime thread history had already disappeared after a backend restart or SQLite reset. In that state, the user saw a thread shell with local workbench context but no runtime messages, and there was no explicit product explanation.

## Goal

Detect restored-thread/runtime-history drift conservatively and route the user into a clear recovery path.

## Constraints

- Keep the current CopilotKit SSE runtime and SQLite runner architecture.
- Avoid false positives for genuinely empty or brand-new threads.
- Reuse the V9 replay-prompt recovery path instead of inventing a second retry system.

## Design

1. Add a pure helper that treats a thread as restorable only when the local workbench has durable context:
   - `lastUserPrompt`
   - `finalSummary`
   - `todos`
   - `artifacts`
2. Treat runtime history as missing only when:
   - runtime availability is `ready`
   - restorable local context exists
   - hydrated runtime message count remains `0`
3. Add a short grace timer before surfacing the warning so normal connect hydration has time to finish.
4. Surface a new recoverable state:
   - `thread_history_unavailable`
5. Reuse actions:
   - `Retry last task`
   - `Create recommended thread`

## Expected Outcome

- A restored thread with missing runtime history is no longer silent or confusing.
- Beginners get a concrete explanation and a direct recovery action.
- Remaining restart/resume work is narrowed to proving deeper real-backend message restoration consistency, not just surfacing the loss.
