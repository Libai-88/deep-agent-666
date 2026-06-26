# V11 Thread History Drift Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect restored threads whose runtime message history is only partially recovered and is missing the latest locally persisted task prompt.

**Architecture:** Reuse the V9 replay prompt and V10 history-gap warning. Extend the pure history helper so the page can detect not only zero-message restores, but also partial restores where some runtime history comes back while the latest locally persisted user prompt is absent.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit React Core v2, Vitest, Playwright

## Global Constraints

- Keep the current CopilotKit runtime and SQLite runner architecture.
- Reuse the existing `thread_history_unavailable` recoverable state instead of inventing a second warning type.
- Keep detection conservative and based on persisted local thread context.
- Follow TDD and update docs only after fresh verification.

---

### Task 1: Extend Pure History-Drift Detection

**Files:**
- Modify: `web/src/lib/thread-history-gap.ts`
- Modify: `web/src/lib/__tests__/thread-history-gap.test.ts`

**Interfaces:**
- Produces: `normalizeMessageText(content): string`
- Produces: `restoredMessagesIncludePrompt(messages, prompt): boolean`
- Produces: `shouldFlagThreadHistoryGap({ runtimeAvailability, hasRestorableContext, messageCount, lastUserPrompt, restoredPromptPresent }): boolean`

- [ ] Write failing unit tests for partial-history drift
- [ ] Run focused unit tests and confirm failure
- [ ] Implement minimal helper changes
- [ ] Re-run focused unit tests and confirm pass

### Task 2: Surface Partial-History Drift In The Page

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/tests/e2e/thread-history-gap-recovery.spec.ts`
- Create: `web/tests/e2e/thread-history-drift-recovery.spec.ts`

**Interfaces:**
- Consumes: `restoredMessagesIncludePrompt(...)`
- Produces: warning when runtime restores some messages but omits the locally persisted last user prompt

- [ ] Write the failing browser regression for partial-history drift
- [ ] Run the browser regression and confirm failure
- [ ] Implement page-level prompt-presence check
- [ ] Re-run the browser regression and confirm pass

### Task 3: Verify, Document, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`
- Create: `docs/superpowers/specs/2026-06-27-v11-thread-history-drift-recovery-design.md`

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs to reflect partial-history drift detection
- [ ] Commit and push

## Self-Review

- Spec coverage: this plan extends the current P0 runtime restore hardening from total history loss to partial history drift.
- Placeholder scan: no placeholders remain.
- Type consistency: the same `thread_history_unavailable` state remains the single product-level warning for restored-thread drift.
