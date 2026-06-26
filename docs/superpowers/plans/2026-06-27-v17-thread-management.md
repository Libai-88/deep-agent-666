# V17 Thread Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let beginners rename and delete local threads safely, while keeping thread ordering, active-thread fallback, and persisted workbench state consistent.

**Architecture:** Add small pure thread-management helpers in `lib/`, wire inline rename/delete controls into the thread list, and handle active-thread fallback in the page state layer. Prove the behavior with one focused unit expansion and one browser regression.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright

## Global Constraints

- Keep thread management local-first; do not introduce remote thread APIs.
- Preserve the current `LocalThread` data shape.
- Deleting a thread must also remove its local workbench persistence.
- Prefer small pure helpers for ordering and fallback decisions instead of page-only branching.
- Do not broaden scope into archive/search/multi-select thread management.

---

### Task 1: Thread Registry Helpers And Local Persistence Cleanup

**Files:**
- Modify: `web/src/lib/thread-registry.ts`
- Modify: `web/src/lib/__tests__/thread-registry.test.ts`
- Modify: `web/src/lib/workbench-state.ts`

**Interfaces:**
- Consumes: `LocalThread`, thread local-storage key, workbench local-storage key
- Produces: sorted thread loading/saving, delete fallback helper, workbench-state removal helper

- [ ] Write the failing unit tests for sorted thread order and next-thread fallback.
- [ ] Run `npm --prefix web run test -- src/lib/__tests__/thread-registry.test.ts` and confirm failure.
- [ ] Implement the minimal helper additions and workbench-state removal support.
- [ ] Re-run `npm --prefix web run test -- src/lib/__tests__/thread-registry.test.ts` and confirm pass.

### Task 2: Thread List Rename/Delete Product Flow

**Files:**
- Modify: `web/src/components/ThreadList.tsx`
- Modify: `web/src/app/page.tsx`
- Create: `web/tests/e2e/thread-management.spec.ts`

**Interfaces:**
- Consumes: thread list state, query-param `threadId`, local thread/workbench persistence
- Produces: inline rename, delete action, active-thread fallback, last-thread starter fallback

- [ ] Write the failing Playwright regression for rename, active-thread delete fallback, and last-thread delete fallback.
- [ ] Run `npm --prefix web run e2e -- thread-management.spec.ts` and confirm failure.
- [ ] Implement the minimal UI/state changes needed to pass the regression.
- [ ] Re-run `npm --prefix web run e2e -- thread-management.spec.ts` and confirm pass.

### Task 3: Full Verification, Docs, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed V17 behavior and latest suite counts
- Produces: updated product status/docs for local thread management

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and counts for V17
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers rename, delete, fallback, and local workbench cleanup.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan preserves the existing `LocalThread` shape and adds helper behavior around it rather than introducing new storage schema.
