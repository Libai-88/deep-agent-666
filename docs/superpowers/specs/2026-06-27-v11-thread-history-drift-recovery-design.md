# V11 Thread History Drift Recovery Design

## Problem

V10 made total history loss visible, but a subtler failure mode still remained: the runtime could restore some older messages while silently missing the latest locally persisted user task. That left the thread looking partly alive even though the most important local context had drifted.

## Goal

Treat partial runtime-history restore drift as a recoverable product state, not just full history loss.

## Constraints

- Reuse the existing `thread_history_unavailable` warning state.
- Keep the detection conservative and anchored to persisted local thread context.
- Reuse V9 replay-prompt recovery instead of creating a second resume path.

## Design

1. Normalize user-message text from restored runtime history.
2. Compare restored runtime user messages against `workbenchState.lastUserPrompt`.
3. Continue warning when message history is fully empty.
4. Also warn when:
   - runtime is reachable
   - restorable local context exists
   - runtime restored some messages
   - but none of those restored user messages match the latest locally persisted prompt

## Expected Outcome

- The app no longer treats a partially restored but drifted thread as healthy.
- Recovery remains simple for beginners: retry the last task or create a fresh thread.
- The remaining runtime restore gap is narrowed to proving true backend restart/resume fidelity, not just detecting missing history.
