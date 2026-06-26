# V10 Thread History Gap Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when a locally restored thread still exists in the product shell but its CopilotKit runtime history is missing, then guide the user into a deterministic recovery path.

**Architecture:** Reuse the existing SQLite-backed runtime, local thread registry, and persisted workbench state. Add a tiny frontend detection helper that treats a thread as "history missing" only when the runtime is reachable, the thread has restorable local context, and the runtime still hydrates zero messages after a grace window. Surface that as a new recoverable product state and reuse the persisted retry prompt path from V9.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit React Core v2, Vitest, Playwright

## Global Constraints

- Do not replace the CopilotKit runtime or agent runner stack.
- Keep detection conservative: no warning for truly empty/new threads.
- Reuse the V9 persisted replay prompt path for recovery.
- Follow TDD: write failing tests before production code.
- Update docs and verification counts to reflect shipped V10 behavior exactly.

---

### Task 1: Add Pure Thread-History Gap Detection

**Files:**
- Create: `web/src/lib/thread-history-gap.ts`
- Test: `web/src/lib/__tests__/thread-history-gap.test.ts`
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/lib/__tests__/runtime-errors.test.ts`

**Interfaces:**
- Consumes: `ThreadWorkbenchState`, runtime availability string, message count
- Produces: `hasRestorableThreadContext(state): boolean`
- Produces: `shouldFlagThreadHistoryGap({ runtimeAvailability, hasRestorableContext, messageCount }): boolean`
- Produces: `RecoverableErrorCode = "thread_history_unavailable"`

- [ ] Write failing unit tests
- [ ] Run the focused unit tests and confirm failure
- [ ] Implement the pure helper and new recoverable action mapping
- [ ] Re-run focused unit tests and confirm pass

### Task 2: Surface Runtime-History Drift In The Page

**Files:**
- Modify: `web/src/app/page.tsx`
- Test: `web/tests/e2e/thread-history-gap-recovery.spec.ts`

**Interfaces:**
- Consumes: `shouldFlagThreadHistoryGap(...)`, `workbenchState.lastUserPrompt`, `agent.messages`
- Produces: page-level `recoverableError = "thread_history_unavailable"` when a restored thread has local context but runtime history stays empty

- [ ] Write the failing browser regression for restored thread history loss
- [ ] Run the browser regression and confirm failure
- [ ] Implement detection timer, notice presentation, and recovery clearing behavior
- [ ] Re-run the browser regression and confirm pass

### Task 3: Verify, Document, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`
- Create: `docs/superpowers/specs/2026-06-27-v10-thread-history-gap-recovery-design.md`

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs to describe the new restored-thread warning and remaining restart/resume gap
- [ ] Commit and push

## Self-Review

- Spec coverage: this plan targets the current P0 called out in `README.md`, `STATUS.md`, and `SPEC.md` by hardening restored-thread recovery when runtime history has disappeared.
- Placeholder scan: no placeholders remain.
- Type consistency: `thread_history_unavailable` is defined once and reused consistently across helpers, UI, and tests.
