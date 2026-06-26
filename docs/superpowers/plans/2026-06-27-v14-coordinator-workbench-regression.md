# V14 Coordinator Workbench Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the coordinator starter flow renders planner/executor/reviewer workbench surfaces correctly, and make timeline status copy clearer for beginners.

**Architecture:** Keep the existing coordinator protocol and workbench state pipeline. Add a small presentation helper in the timeline panel and a deterministic Playwright regression that drives the normal starter launch path with mocked AG-UI tool/state events.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, CopilotKit React Core v2

## Global Constraints

- Reuse the real starter-template launch path.
- Keep the AG-UI stream deterministic and local.
- Follow TDD: failing tests first, then minimal implementation.
- Avoid test-only product branches.

---

### Task 1: Humanize Timeline Status Copy

**Files:**
- Modify: `web/src/components/__tests__/TaskTimelinePanel.test.tsx`
- Modify: `web/src/components/TaskTimelinePanel.tsx`

**Interfaces:**
- Produces: readable labels for `pending`, `in_progress`, and `completed`

- [ ] Write the failing panel test for human-readable statuses
- [ ] Run the focused panel test and confirm failure
- [ ] Implement the minimal status-label helper
- [ ] Re-run the focused panel test and confirm pass

### Task 2: Add Coordinator Browser Regression

**Files:**
- Create: `web/tests/e2e/coordinator-workbench-regression.spec.ts`

**Interfaces:**
- Consumes: starter template launch path
- Produces: deterministic browser proof for planner/executor/reviewer cards, timeline tasks, and results summary

- [ ] Write the failing Playwright regression
- [ ] Run the focused browser regression and confirm failure
- [ ] Implement only the minimal product/test support needed
- [ ] Re-run the focused browser regression and confirm pass

### Task 3: Verify, Document, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and test counts for V14
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers both beginner-facing copy polish and the missing coordinator browser regression.
- Placeholder scan: no placeholders remain.
- Type consistency: the change stays inside existing todo status values and does not alter the serialized workbench schema.
