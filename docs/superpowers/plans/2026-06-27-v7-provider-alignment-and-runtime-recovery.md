# V7 Provider Alignment And Runtime Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align OpenAI presets with actual OpenAI defaults and surface common upstream runtime failures as recoverable product states.

**Architecture:** Keep provider truth in backend presets, add pure runtime error classification in frontend utilities, and wire page-level runtime error handling through that classifier.

**Tech Stack:** FastAPI, Deep Agents, Next.js 16, React 19, Vitest, Pytest

## Global Constraints

- Keep the beginner path literal: `OpenAI` means OpenAI-compatible defaults, not OpenRouter-specific model ids.
- Do not add a new provider family in this phase.
- Test first, then implement, then run full verification and push.

---

### Task 1: Lock Provider Alignment With Failing Tests

**Files:**
- Modify: `agent/tests/test_config_and_presets.py`
- Modify: `web/src/lib/__tests__/runtime-errors.test.ts`

- [ ] Add a failing backend preset expectation for the OpenAI default model.
- [ ] Add a failing backend regression that forbids `openrouter/` in OpenAI presets.
- [ ] Add failing frontend runtime-error classification tests for quota and invalid-model cases.
- [ ] Run targeted tests and verify red.

### Task 2: Implement Minimal Production Fix

**Files:**
- Modify: `agent/app/presets.py`
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/app/page.tsx`

- [ ] Align the OpenAI preset family to `gpt-4.1-mini`.
- [ ] Add recoverable runtime error classification helpers.
- [ ] Wire page-level CopilotKit/runtime failures through the classifier.
- [ ] Re-run targeted tests and verify green.

### Task 3: Update Product Documentation

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

- [ ] Record V7 as the provider-alignment/runtime-recovery phase.
- [ ] Update counts and remaining risk notes where needed.

### Task 4: Full Verification And Version Control

- [ ] Run:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
- [ ] Commit with a conventional message.
- [ ] Push `feat/deepagents-foundation` to `origin`.
- [ ] Clean residual processes.
