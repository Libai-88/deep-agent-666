# V19 Runtime Bootstrap Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backend recovery in the current browser tab actually re-bootstrap CopilotKit so a beginner can continue launching tasks without a manual reload.

**Architecture:** Reuse the existing runtime bootstrap event channel as the single root remount hook, wire recovery actions through a shared refresh helper that also requests bootstrap refresh, and prove the end-to-end continuity with one browser regression that goes all the way through a fresh assistant response.

**Tech Stack:** Next.js 16, React 19, TypeScript, Playwright

## Global Constraints

- Reuse the existing `requestRuntimeBootstrapRefresh()` event channel; do not invent a second bootstrap mechanism.
- Keep the fix product-level and same-tab focused; do not add backend restart automation.
- Recovery actions must not claim success based only on diagnostics/preset refresh; the runtime bridge must also be refreshed.
- Preserve current Settings save behavior while extending the same bootstrap semantics to retry/recovery paths.

---

### Task 1: Recovery Refresh Contract

**Files:**
- Modify: `web/src/app/page.tsx`
- Optionally modify: `web/src/lib/runtime-bootstrap.ts`

**Interfaces:**
- Consumes: `requestRuntimeBootstrapRefresh()`, `reloadCatalogState()`, `reloadRuntimeSettings()`, `reloadRuntimeDiagnostics()`
- Produces: one shared recovery refresh helper that also requests runtime bootstrap readiness

- [ ] Write the failing browser regression first so the bootstrap continuity gap is proven before implementation.
- [ ] Run `npm --prefix web run e2e -- runtime-reconnect-recovery.spec.ts` and confirm failure.
- [ ] Implement the shared recovery refresh helper so retry/reconnect actions request root bootstrap refresh after state refresh.
- [ ] Re-run `npm --prefix web run e2e -- runtime-reconnect-recovery.spec.ts` and confirm pass.

### Task 2: Runtime Recovery Browser Proof

**Files:**
- Create: `web/tests/e2e/runtime-reconnect-recovery.spec.ts`

**Interfaces:**
- Consumes: offline-to-online preset/runtime mocks, recovery CTA, starter template flow
- Produces: proof that one tab can recover from offline state to a successful first guided run without full-page reload

- [ ] Model offline startup with configured provider snapshot but unavailable runtime endpoints.
- [ ] Switch mocks to healthy runtime after the page is already open.
- [ ] Verify `Retry connection` leads to starter templates and then to a successful assistant response in the same tab.

### Task 3: Full Verification, Docs, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed reconnect continuity behavior and latest test counts
- Produces: updated project status for V19

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and counts for V19
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers the reconnect bug itself, the product-level recovery trigger, and browser proof that the runtime is truly usable again.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan keeps bootstrap refresh behind the existing `requestRuntimeBootstrapRefresh()` contract instead of scattering remount logic across multiple files.
