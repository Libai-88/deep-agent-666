# V8 Runtime Failure Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure real upstream provider failures terminate as valid AG-UI runs and map into explicit frontend recovery states.

**Architecture:** Normalize failures at the Python route boundary, emit structured `RUN_ERROR.code` values, and teach frontend recovery classification to prefer structured codes.

**Tech Stack:** FastAPI, ag-ui, Deep Agents, Next.js 16, React 19, Pytest, Vitest

## Global Constraints

- Preserve AG-UI protocol ordering: `RUN_STARTED` first, terminal `RUN_ERROR` last on failures.
- Do not emit `RUN_FINISHED` after `RUN_ERROR`.
- Log full backend exceptions server-side, but keep client-facing messages bounded and safe.

---

### Task 1: Write Failing Reproduction Tests

**Files:**
- Create: `agent/tests/test_agui_route_errors.py`
- Modify: `web/src/lib/__tests__/runtime-errors.test.ts`

- [ ] Reproduce that direct AG-UI routes currently raise instead of emitting `RUN_ERROR`.
- [ ] Reproduce that access-denied provider failures are not yet classified in the frontend.
- [ ] Verify red.

### Task 2: Normalize Backend Failure Streams

**Files:**
- Modify: `agent/app/main.py`

- [ ] Catch route-stream exceptions inside the async generator.
- [ ] Synthesize `RUN_STARTED` if the stream failed before emitting one.
- [ ] Close any open text/reasoning/tool frames before the terminal error.
- [ ] Emit structured `RUN_ERROR.code` values for common provider failures.

### Task 3: Extend Frontend Recovery Classification

**Files:**
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/app/page.tsx`

- [ ] Recognize `provider_access_denied` from structured codes first.
- [ ] Keep string heuristics as fallback for legacy/unstructured failures.
- [ ] Render a dedicated user-facing recovery notice.

### Task 4: Verify And Document

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

- [ ] Reproduce a real provider failure and confirm it now ends with `RUN_ERROR`.
- [ ] Run full backend/frontend verification.
- [ ] Document V8 status, evidence, and remaining risks.
- [ ] Commit, push, and clean processes.
