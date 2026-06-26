# V15 Runtime Config Workspace Root Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let beginners inspect and change the active workspace root from inside the product, using the app's own runtime-config route instead of raw browser calls to the backend.

**Architecture:** Extend the FastAPI runtime configuration surface with a safe read endpoint and a validated workspace-root mutation path. Add a same-origin Next.js proxy plus a small runtime-settings normalization layer, then wire the existing settings dialog and page context to that new boundary.

**Tech Stack:** FastAPI, Pydantic, Next.js 16 App Router, React 19, TypeScript, Vitest, Playwright, pytest

## Global Constraints

- Keep runtime mutation process-local; do not write back to `.env`.
- Do not expose raw API keys through any new endpoint.
- Reuse the existing runtime bootstrap refresh flow after successful saves.
- Preserve the current preset catalog and CopilotKit runtime architecture.
- Add regression coverage for both backend validation and the beginner-facing settings flow.

---

### Task 1: Backend Runtime Config Snapshot And Workspace Validation

**Files:**
- Modify: `agent/app/config.py`
- Modify: `agent/app/main.py`
- Modify: `agent/tests/test_live_provider_activation.py`

**Interfaces:**
- Consumes: `ConfigStore`, `load_settings()`, `build_runtime_registry(...)`
- Produces: `GET /config`, `POST /configure` with optional `agent_workspace_root`

- [ ] Write the failing backend tests for runtime config snapshot and workspace-root validation.
- [ ] Run `uv run --project agent pytest -v agent/tests/test_live_provider_activation.py` and confirm the new assertions fail.
- [ ] Implement `ConfigStore.workspace_root`, workspace-root normalization/validation, `GET /config`, and the extended `/configure` response/error handling.
- [ ] Re-run `uv run --project agent pytest -v agent/tests/test_live_provider_activation.py` and confirm pass.

### Task 2: Same-Origin Runtime Config Route And Normalization Helpers

**Files:**
- Create: `web/src/app/api/runtime-config/route.ts`
- Create: `web/src/app/api/runtime-config/route.test.ts`
- Create: `web/src/lib/runtime-settings.ts`
- Create: `web/src/lib/__tests__/runtime-settings.test.ts`

**Interfaces:**
- Consumes: backend `GET /config`, backend `POST /configure`
- Produces: `GET /api/runtime-config`, `POST /api/runtime-config`, `normalizeRuntimeSettings(payload)`

- [ ] Write the failing Vitest coverage for runtime-settings normalization and the new route proxy.
- [ ] Run `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts` and confirm failure.
- [ ] Implement the runtime-settings helper and the Next.js route proxy with backend error forwarding.
- [ ] Re-run `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts` and confirm pass.

### Task 3: Settings Dialog Workspace Root Flow

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/tests/e2e/settings-workspace-root.spec.ts`

**Interfaces:**
- Consumes: `/api/runtime-config`, `requestRuntimeBootstrapRefresh()`, `resolveRecoverableErrorCode(...)`
- Produces: workspace-root field loading/saving, visible workspace label, corrected `useAgentContext` workspace root

- [ ] Write the failing browser regression for opening settings, loading the current workspace root, and saving through `/api/runtime-config`.
- [ ] Run `npm --prefix web run e2e -- settings-workspace-root.spec.ts` and confirm failure.
- [ ] Implement the minimal page/settings changes: load runtime config, add workspace root input, save through the same-origin route, update page state, and render the current workspace root label.
- [ ] Re-run `npm --prefix web run e2e -- settings-workspace-root.spec.ts` and confirm pass.

### Task 4: Documentation, Full Verification, And Push

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: completed V15 feature and test counts
- Produces: updated milestone/docs state for runtime-config workspace-root support

- [ ] Run `npm --prefix web run typecheck`
- [ ] Run `npm --prefix web run test`
- [ ] Run `npm --prefix web run build`
- [ ] Run `npm --prefix web run e2e`
- [ ] Run `uv run --project agent pytest -v`
- [ ] Update docs for V15 behavior and counts
- [ ] Commit and push

## Self-Review

- Spec coverage: the plan covers backend mutation, same-origin proxying, beginner-facing settings UX, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: the plan uses one workspace-root field name across backend (`agent_workspace_root`) and frontend normalized state (`workspaceRoot`).
