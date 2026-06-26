# V12 Runtime Persistence Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that a completed CopilotKit runtime thread can be restored across runtime instances from the shared SQLite thread store, even after the original backend surface is gone.

**Architecture:** Reuse the production `createRuntimeFromCatalog(...)` assembly (`CopilotRuntime` + `SqliteAgentRunner` + remote `HttpAgent`) and exercise it through the real `createCopilotRuntimeHandler(...)` fetch endpoint.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit Runtime v2, `@ag-ui/client`, Vitest

## Global Constraints

- Keep the production runtime topology intact; do not add test-only branches to product code.
- Use TDD: write the integration test first, watch it fail, then make the minimal change needed.
- Prefer a deterministic local backend stub over a real provider dependency.
- Verify with the full web and agent suites before updating docs.

---

### Task 1: Add A Runtime-Level Persistence Regression

**Files:**
- Create: `web/src/lib/__tests__/copilot-runtime.persistence.test.ts`

**Interfaces:**
- Consumes: `createRuntimeFromCatalog(...)`
- Consumes: `createCopilotRuntimeHandler(...)`
- Produces: proof that `/agent/:id/run` persists history and `/agent/:id/connect` restores it from the same SQLite file on a fresh runtime instance

- [ ] Write the failing runtime persistence integration test
- [ ] Run the focused test and confirm failure
- [ ] Implement the minimal test helper changes needed for deterministic SSE reading
- [ ] Re-run the focused test and confirm pass

### Task 2: Verify The Whole Product Surface

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`
- Create: `docs/superpowers/specs/2026-06-27-v12-runtime-persistence-proof-design.md`

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs to reflect the new persistence proof and test counts
- [ ] Commit and push

## Self-Review

- Spec coverage: this closes the documented evidence gap around runtime-level SQLite restore fidelity.
- Placeholder scan: no placeholders remain.
- Type consistency: the proof sits at the runtime layer and does not weaken the existing product-level history-gap protections.
