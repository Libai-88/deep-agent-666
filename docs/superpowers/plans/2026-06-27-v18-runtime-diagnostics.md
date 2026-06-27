# V18 Runtime Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give beginners a single in-product runtime diagnostics surface that explains backend reachability, preset readiness, fallback state, and active workspace context.

**Architecture:** Add one normalized diagnostics model and one same-origin aggregation route, then surface the snapshot through a small header badge plus a reusable dialog that existing recovery flows can open. Keep status classification pure and testable so page state stays thin.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright

## Global Constraints

- Reuse existing `/health`, `/config`, `/preset-state`, and runtime info signals instead of inventing new backend APIs when possible.
- Keep status vocabulary limited to `healthy`, `setup-required`, `degraded`, and `offline`.
- Diagnostics must be visible from both onboarding and active-thread flows.
- Do not add process-management or auto-restart behavior.
- Preserve the existing settings dialog and recoverable-error flow; diagnostics is an adjacent support surface.

---

### Task 1: Runtime Diagnostics Contract And Aggregation Route

**Files:**
- Create: `web/src/lib/runtime-diagnostics.ts`
- Create: `web/src/lib/__tests__/runtime-diagnostics.test.ts`
- Create: `web/src/app/api/runtime-diagnostics/route.ts`
- Create: `web/src/app/api/runtime-diagnostics/route.test.ts`

**Interfaces:**
- Consumes: backend `/health`, backend `/config`, same-origin `/api/preset-state`
- Produces: `RuntimeDiagnostics`, `normalizeRuntimeDiagnostics()`, `resolveRuntimeDiagnosticsStatus()`, `GET()`

- [ ] Write the failing Vitest cases for healthy, setup-required, degraded, and offline diagnostics normalization.
- [ ] Run `npm --prefix web run test -- src/lib/__tests__/runtime-diagnostics.test.ts src/app/api/runtime-diagnostics/route.test.ts` and confirm failure.
- [ ] Implement the normalized diagnostics model and same-origin aggregation route.
- [ ] Re-run `npm --prefix web run test -- src/lib/__tests__/runtime-diagnostics.test.ts src/app/api/runtime-diagnostics/route.test.ts` and confirm pass.

### Task 2: Header Badge, Diagnostics Dialog, And Recovery Wiring

**Files:**
- Create: `web/src/components/RuntimeDiagnosticsDialog.tsx`
- Create: `web/src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx`
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `RuntimeDiagnostics`, recoverable action handling, page-level refresh flows
- Produces: header runtime badge, diagnostics dialog, `view_diagnostics` recovery action, shared refresh path

- [ ] Write the failing component test that renders an offline/degraded diagnostics dialog with refresh and provider details.
- [ ] Run `npm --prefix web run test -- src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx` and confirm failure.
- [ ] Implement the header badge, dialog state, diagnostics refresh loader, and recovery-action integration.
- [ ] Re-run `npm --prefix web run test -- src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx` and confirm pass.

### Task 3: Browser Regression, Docs, Verification, And Push

**Files:**
- Create: `web/tests/e2e/runtime-diagnostics.spec.ts`
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed diagnostics route/UI behavior
- Produces: one browser proof for the beginner recovery flow and updated product docs/status

- [ ] Write the failing Playwright regression for offline diagnostics visibility and refresh recovery.
- [ ] Run `npm --prefix web run e2e -- runtime-diagnostics.spec.ts` and confirm failure.
- [ ] Implement any remaining UI/test-id adjustments needed for the regression to pass.
- [ ] Re-run `npm --prefix web run e2e -- runtime-diagnostics.spec.ts` and confirm pass.
- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs and counts for V18
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers diagnostics aggregation, visible product surfacing, recovery integration, browser proof, and documentation.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan centers all UI around one `RuntimeDiagnostics` contract rather than duplicating status fields across page state and components.
