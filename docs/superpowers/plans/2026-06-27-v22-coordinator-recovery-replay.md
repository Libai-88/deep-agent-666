# V22 Coordinator Recovery Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinator-specific recovery replay regression, and fix product code only if that regression reveals a real thread-recovery gap.

**Architecture:** Reuse the existing active-thread shell, history-gap detection, and `Retry last task` flow. The new work should primarily live in Playwright coverage so the deepest coordinator restart/resume path becomes enforced instead of assumed.

**Tech Stack:** Next.js 16, React 19, TypeScript, Playwright, Vitest, pytest

## Global Constraints

- Preserve the existing recovery model; do not invent a second retry workflow.
- Keep the scenario inside one active thread from outage through replay.
- Only touch production code if the new regression proves current behavior is insufficient.
- Maintain deterministic fixtures with no dependency on external model availability.

---

### Task 1: Coordinator Recovery Replay Regression

**Files:**
- Create: `web/tests/e2e/coordinator-recovery-replay.spec.ts`
- Modify: `web/src/app/page.tsx` only if the failing regression exposes a product gap
- Modify: `web/src/lib/thread-history-gap.ts` only if the failing regression exposes a product gap
- Modify: `web/src/lib/runtime-errors.ts` only if the failing regression exposes a product gap

**Interfaces:**
- Consumes: persisted `deep-agent-666.threads`, persisted `deep-agent-666.workbench.<threadId>`, `Retry connection`, `Retry last task`
- Produces: deterministic browser proof that a coordinator thread can replay after reconnect and re-render coordinator surfaces in the same thread

- [x] Write the failing Playwright regression for coordinator recovery replay.
- [x] Run `npm --prefix web run e2e -- coordinator-recovery-replay.spec.ts` and confirm the initial status.
- [x] Implement the smallest production-code fix required if the regression fails.
- [x] Re-run `npm --prefix web run e2e -- coordinator-recovery-replay.spec.ts` and confirm pass.

### Task 2: Full Verification And Docs

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed coordinator recovery replay behavior and updated suite counts
- Produces: V22 status/docs aligned with the verified regression baseline

- [x] Run `npm --prefix web run typecheck`.
- [x] Run `npm --prefix web run test`.
- [x] Run `npm --prefix web run build`.
- [x] Run `npm --prefix web run e2e`.
- [x] Run `uv run --project agent pytest -v`.
- [x] Update docs with the V22 baseline and latest counts.
- [x] Commit and push.

## Self-Review

- Spec coverage: the plan covers the missing coordinator recovery replay path plus repository-wide verification.
- Placeholder scan: no placeholders remain.
- Type consistency: all referenced thread recovery interfaces already exist in the current product.
