# V21 Contextual Recovery Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a direct `Retry last task` recovery path for active-thread backend failures when a stored last prompt exists.

**Architecture:** Keep recoverable-action defaults simple, but allow the action resolver to accept active-thread context so the workbench notice can expose retry affordances that the onboarding gate should not show. Reuse the existing stored prompt and in-thread retry flow rather than inventing a separate recovery workflow.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright

## Global Constraints

- Preserve existing default action lists for gate/onboarding contexts unless thread context explicitly changes them.
- Do not auto-run tasks without a user click.
- Reuse `pendingThreadRun` rather than adding a second retry queue.
- Keep the change focused on active-thread `backend_unreachable` recovery.

---

### Task 1: Context-Aware Recoverable Actions

**Files:**
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/lib/__tests__/runtime-errors.test.ts`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: recoverable error code, active-thread presence, last prompt presence
- Produces: contextual `Retry last task` action lists for workbench recovery

- [x] Add failing unit coverage for backend-unreachable actions with and without retryable thread context.
- [x] Run `npm --prefix web run test -- src/lib/__tests__/runtime-errors.test.ts` and confirm failure.
- [x] Implement contextual action resolution and wire the workbench notice through it.
- [x] Re-run `npm --prefix web run test -- src/lib/__tests__/runtime-errors.test.ts` and confirm pass.

### Task 2: Retry Continuity Browser Proof

**Files:**
- Create: `web/tests/e2e/queued-retry-after-reconnect.spec.ts`

**Interfaces:**
- Consumes: active-thread backend-unreachable recovery, stored `lastUserPrompt`, reconnect flow
- Produces: proof that retry remains available across reconnect and can be replayed in-thread after recovery

- [x] Write the failing Playwright regression for retry continuity across reconnect.
- [x] Run `npm --prefix web run e2e -- queued-retry-after-reconnect.spec.ts` and confirm failure.
- [x] Implement any remaining page wiring needed for the regression to pass.
- [x] Re-run `npm --prefix web run e2e -- queued-retry-after-reconnect.spec.ts` and confirm pass.

### Task 3: Full Verification, Docs, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed contextual recovery behavior and latest suite counts
- Produces: updated project docs/status for V21

- [x] Run `npm --prefix web run typecheck`
- [x] Run `npm --prefix web run test`
- [x] Run `npm --prefix web run build`
- [x] Run `npm --prefix web run e2e`
- [x] Run `uv run --project agent pytest -v`
- [x] Update docs and counts for V21
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers contextual action computation, the in-thread retry recovery path, and documentation.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan builds on `RecoverableAction` and `pendingThreadRun` rather than introducing a parallel retry model.
