# V16 Coordinator Restored Thread Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that a completed coordinator thread reopens cleanly after a page reload, with restored chat history and persisted workbench state staying aligned and without false recovery warnings.

**Architecture:** Reuse the existing deterministic coordinator starter flow, then add one Playwright lifecycle regression that switches the mocked `connect` response on reload from an empty connection to a healthy restored history stream. Keep product code unchanged unless the new regression exposes a real continuity bug.

**Tech Stack:** Next.js 16, React 19, TypeScript, Playwright, Vitest, FastAPI, pytest

## Global Constraints

- Reuse the real starter-template launch path.
- Keep the AG-UI stream deterministic and local.
- Prefer a test-only change unless the browser regression reveals a real product defect.
- Do not broaden the scope into full multi-process restart orchestration.
- Preserve the current thread/workbench persistence format.

---

### Task 1: Add Coordinator Reload Continuity Browser Regression

**Files:**
- Create: `web/tests/e2e/coordinator-restored-thread-continuity.spec.ts`

**Interfaces:**
- Consumes: starter-template launch path, existing coordinator tool/state stream shape, restored `connect` history stream
- Produces: browser proof for healthy coordinator-thread reload continuity

- [ ] Write the failing Playwright lifecycle regression for coordinator run -> reload -> healthy restore.
- [ ] Run `npm --prefix web run e2e -- coordinator-restored-thread-continuity.spec.ts` and confirm failure.
- [ ] Implement the minimal product/test support needed, if the regression exposes a real bug.
- [ ] Re-run `npm --prefix web run e2e -- coordinator-restored-thread-continuity.spec.ts` and confirm pass.

### Task 2: Full Verification, Docs, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed V16 regression and latest suite counts
- Produces: updated product/test documentation for healthy restored coordinator continuity

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and test counts for V16
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan directly covers the missing healthy restored-thread browser proof for the coordinator path.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan keeps the existing AG-UI event shapes and thread/workbench persistence model unchanged.
