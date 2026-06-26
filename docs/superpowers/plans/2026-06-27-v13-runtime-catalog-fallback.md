# V13 Runtime Catalog Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the last known preset catalog locally so the main CopilotKit route can restore persisted threads even when `/presets` is temporarily unavailable.

**Architecture:** Extend `loadRuntimeCatalog(...)` with a small file-backed cache that stores the last live normalized catalog. Reuse that cached catalog on live-fetch failure, and prove the behavior through the real `web/src/app/api/copilotkit/[[...slug]]/route.ts` entrypoint after a simulated module reload.

**Tech Stack:** Next.js 16, TypeScript, Vitest, CopilotKit Runtime v2, SQLite runner, Node fs

## Global Constraints

- Keep `source: "live" | "fallback"` unchanged.
- Live `/presets` responses remain authoritative over cached data.
- Follow TDD: failing test first, then minimal implementation.
- Do not introduce test-only branches into production code.

---

### Task 1: Add Runtime Catalog Cache Coverage

**Files:**
- Modify: `web/src/lib/__tests__/runtime-agents.test.ts`
- Modify: `web/src/lib/runtime-agents.ts`

**Interfaces:**
- Produces: `loadRuntimeCatalog(baseUrl: string): Promise<RuntimeCatalogState>`
- Produces: optional cache path env handling for runtime catalog persistence

- [ ] Write the failing runtime-agents test for cache-backed fallback
- [ ] Run the focused test and confirm failure
- [ ] Implement the minimal file-backed cache behavior
- [ ] Re-run the focused test and confirm pass

### Task 2: Prove The Real Route Restores Through Cached Catalog

**Files:**
- Create: `web/src/app/api/copilotkit/[[...slug]]/route.persistence.test.ts`

**Interfaces:**
- Consumes: `GET/POST` exports from `web/src/app/api/copilotkit/[[...slug]]/route.ts`
- Produces: route-level regression proof for persisted-thread restore after module reload and preset-catalog outage

- [ ] Write the failing route-level persistence regression
- [ ] Run the focused regression and confirm failure
- [ ] Adjust implementation only as needed to satisfy the route-level restore path
- [ ] Re-run the focused regression and confirm pass

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
- [ ] Update docs and test counts for V13
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers both the file-backed fallback behavior and the real route-level restore proof.
- Placeholder scan: no placeholders remain.
- Type consistency: the fallback stays inside the existing runtime catalog API without adding a new frontend source enum.
