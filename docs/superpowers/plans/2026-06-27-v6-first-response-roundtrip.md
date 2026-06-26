# V6 First Response Roundtrip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first same-session configure flow actually usable by re-bootstrapping `CopilotKit` after save and proving the first assistant response in a deterministic browser E2E.

**Architecture:** Keep runtime bootstrap centralized in the root `Providers` component, trigger a re-bootstrap via an explicit browser event after successful save, and verify the UI path with a deterministic AG-UI SSE fixture in Playwright.

**Tech Stack:** Next.js 16, React 19, @copilotkit/react-core v2, Playwright, TypeScript

## Global Constraints

- Preserve the current single-tab beginner flow: configure in-app, no manual page reload.
- Do not depend on external model providers in E2E.
- Keep the existing smoke suite green.
- End with full verification, commit, push, and process cleanup.

---

### Task 1: Reproduce The Same-Session Bootstrap Gap

**Files:**
- Create: `web/tests/e2e/first-run-roundtrip.spec.ts`

**Interfaces:**
- Consumes:
  - `SettingsDialog` flow in `web/src/app/page.tsx`
  - root runtime bootstrap in `web/src/app/providers.tsx`
- Produces:
  - a failing browser regression that proves post-configure starter launch does not yet render the first assistant response reliably

- [ ] **Step 1: Write the failing browser test**

Cover:
- initial unconfigured gate
- open settings
- save a provider key
- observe starter templates
- launch one starter template
- expect an assistant message to appear

- [ ] **Step 2: Stub deterministic runtime boundaries**

Stub:
- `/api/preset-state`
- `/api/copilotkit/info`
- the selected `/api/copilotkit/agent/.../run` endpoint

with an AG-UI text response lifecycle.

- [ ] **Step 3: Run the targeted E2E and verify failure**

Run: `npm --prefix web run e2e -- --grep "first run configure launches and renders the first assistant response" --workers 1`

Expected: FAIL because the app does not re-bootstrap `CopilotKit` in the same session after save.

### Task 2: Re-Bootstrap CopilotKit After Successful Save

**Files:**
- Modify: `web/src/app/providers.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Produces:
  - a browser event contract for runtime bootstrap refresh
  - re-runnable provider bootstrap logic

- [ ] **Step 1: Extract provider bootstrap logic into a re-runnable async loader**

- [ ] **Step 2: Add a window event listener in `Providers` that re-runs bootstrap after successful save**

- [ ] **Step 3: Dispatch the runtime refresh event from the settings save success path**

- [ ] **Step 4: Re-run the targeted E2E**

Run: `npm --prefix web run e2e -- --grep "first run configure launches and renders the first assistant response" --workers 1`

Expected: PASS

### Task 3: Keep Existing Browser Regressions Green

**Files:**
- Modify if needed: `web/tests/e2e/smoke.spec.ts`
- Modify if needed: `web/tests/e2e/chat-smoke.spec.ts`

**Interfaces:**
- Consumes:
  - existing smoke coverage
- Produces:
  - stable browser suite with the new first-response roundtrip proof

- [ ] **Step 1: Run the existing targeted browser smoke tests**

Run: `npm --prefix web run e2e -- --grep "unconfigured launch shows the first-run gate|configured launch without a thread shows starter templates|renders the local agent shell" --workers 1`

Expected: PASS

- [ ] **Step 2: Adjust tests only if the new bootstrap contract changes startup timing**

### Task 4: Document The New Product Baseline

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Produces:
  - V6 documented as the first-response roundtrip phase

- [ ] **Step 1: Update docs to state that same-session configuration now re-activates the runtime**

- [ ] **Step 2: Record deterministic browser proof of `configure -> launch -> first response`**

### Task 5: Full Verification And Version Control

- [ ] **Step 1: Run frontend verification**

Run:
- `npm --prefix web run test`
- `npm --prefix web run typecheck`
- `npm --prefix web run e2e`

Expected: PASS

- [ ] **Step 2: Run backend regression verification**

Run:
- `uv run --project agent pytest -v`

Expected: PASS

- [ ] **Step 3: Commit**

Use a conventional commit for the first-response roundtrip phase.

- [ ] **Step 4: Push**

Push `feat/deepagents-foundation` to `origin`.

- [ ] **Step 5: Clean residual processes**

Stop any unnecessary `node`, `python`, `git`, and helper PowerShell processes started during verification.
