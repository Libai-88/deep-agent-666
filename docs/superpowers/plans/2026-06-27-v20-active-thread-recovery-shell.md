# V20 Active Thread Recovery Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the active thread workbench during recoverable runtime failures so beginners can recover in place instead of being kicked back to the gate.

**Architecture:** Teach the first-run resolver to distinguish onboarding/gate errors from in-thread recoverable runtime errors, then prove the behavior with one unit expansion and one browser regression built on persisted local thread state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright

## Global Constraints

- Preserve gate behavior for `no_available_presets` and `thread_missing_or_invalid`.
- Preserve the shell only when a valid local active thread exists.
- Reuse the existing `WorkbenchStatusNotice`; do not add another recovery banner system.
- Keep runtime recovery in the current thread when the thread itself remains trustworthy.

---

### Task 1: First-Run State Recovery Classification

**Files:**
- Modify: `web/src/lib/first-run-state.ts`
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/lib/__tests__/first-run-state.test.ts`

**Interfaces:**
- Consumes: `RecoverableErrorCode`, active thread presence
- Produces: preserved `ready-active-thread` state for in-thread runtime recovery cases

- [ ] Add failing unit coverage for active-thread runtime failures and invalid-thread failures.
- [ ] Run `npm --prefix web run test -- src/lib/__tests__/first-run-state.test.ts` and confirm failure.
- [ ] Implement the shell-preservation classification.
- [ ] Re-run `npm --prefix web run test -- src/lib/__tests__/first-run-state.test.ts` and confirm pass.

### Task 2: Active Thread Recovery Browser Proof

**Files:**
- Create: `web/tests/e2e/active-thread-recovery-shell.spec.ts`

**Interfaces:**
- Consumes: persisted local thread/workbench state, backend-unreachable condition, retry connection flow
- Produces: proof that timeline/results remain visible during recoverable backend failure and after reconnect

- [ ] Write the failing Playwright regression for active-thread shell preservation.
- [ ] Run `npm --prefix web run e2e -- active-thread-recovery-shell.spec.ts` and confirm failure.
- [ ] Implement any remaining page wiring needed for the regression to pass.
- [ ] Re-run `npm --prefix web run e2e -- active-thread-recovery-shell.spec.ts` and confirm pass.

### Task 3: Full Verification, Docs, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed active-thread recovery behavior and latest test counts
- Produces: updated status/docs for V20

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and counts for V20
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers classification logic, in-thread product behavior, regression proof, and documentation.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan keeps recovery classification tied to `RecoverableErrorCode` rather than inventing a separate thread-failure enum.
