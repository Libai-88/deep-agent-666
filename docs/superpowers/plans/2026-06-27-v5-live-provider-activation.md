# V5 Live Provider Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make provider configuration live so saving a new provider key immediately makes the corresponding agents and coordinator routes executable without backend restart.

**Architecture:** Introduce a backend runtime registry as the single source of truth for configured agents, route direct AG-UI execution through request-time registry lookup, and make the CopilotKit SDK read from that same live registry.

**Tech Stack:** FastAPI, CopilotKit Python SDK 0.1.94, ag-ui-langgraph 0.0.42, pytest

## Global Constraints

- Preserve the current single FastAPI process topology.
- Do not require backend restart after `/configure`.
- Keep V1 preset routes and coordinator routes externally compatible.
- Preserve balanced/full-access-only coordinator availability.
- End with backend tests, full repo verification, commit, push, and process cleanup.

---

## Task 1: Reproduce The Live Activation Gap

**Files:**
- Create: `agent/tests/test_live_provider_activation.py`

**Interfaces:**
- Consumes:
  - `configure()` from `agent/app/main.py`
  - `presets()` from `agent/app/main.py`
  - live SDK agent listing from `main_module.sdk`
- Produces:
  - regression tests that fail until `/configure` updates executable agent availability

- [ ] **Step 1: Write the failing backend test**

Add tests that:
- boot with only OpenAI configured
- call `/configure` with an Anthropic key
- assert Anthropic preset appears in `/presets`
- assert Anthropic V1/coordinator agents become executable through the live registry-backed surface

- [ ] **Step 2: Run backend tests to verify failure**

Run: `uv run --project agent pytest agent/tests/test_live_provider_activation.py -v`

Expected: FAIL because `/configure` updates config state but does not activate new executable agents.

## Task 2: Add A Runtime Agent Registry

**Files:**
- Create: `agent/app/runtime_registry.py`
- Modify: `agent/app/main.py`

**Interfaces:**
- Produces:
  - `RuntimeAgentRegistry`
  - `build_runtime_registry(settings: AgentSettings) -> RuntimeAgentRegistry`
  - registry helpers for:
    - configured presets
    - V1 agent lookup
    - coordinator lookup
    - combined live agent list

- [ ] **Step 1: Write the failing focused registry tests if needed**
- [ ] **Step 2: Implement the registry as an isolated backend unit**
- [ ] **Step 3: Re-run the new tests**

## Task 3: Switch SDK And Direct Routes To The Live Registry

**Files:**
- Modify: `agent/app/main.py`
- Reuse: `agent/app/runtime_registry.py`

**Interfaces:**
- Consumes:
  - `RuntimeAgentRegistry`
- Produces:
  - dynamic SDK agent callable
  - request-time direct AG-UI dispatch for preset/coordinator execution
  - request-time health dispatch for live agents

- [ ] **Step 1: Replace startup-only static agent globals with registry-backed state**
- [ ] **Step 2: Keep `/copilotkit` backed by a callable `agents=` source**
- [ ] **Step 3: Implement request-time direct dispatch for agent execution**
- [ ] **Step 4: Implement request-time health dispatch for agent routes**
- [ ] **Step 5: Run targeted backend tests**

Run:
- `uv run --project agent pytest agent/tests/test_live_provider_activation.py -v`
- `uv run --project agent pytest agent/tests/test_v2_endpoints.py agent/tests/test_agent_factory.py -v`

Expected: PASS

## Task 4: Align First-Run Reliability Docs

**Files:**
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

- [ ] **Step 1: Update docs to state that `/configure` activates agents live**
- [ ] **Step 2: Remove stale wording that implies backend restart is needed after configuration**

## Task 5: Full Verification And Version Control

- [ ] **Step 1: Run backend verification**

Run:
- `uv run --project agent pytest -v`

Expected: PASS

- [ ] **Step 2: Run frontend verification to ensure no accidental regression**

Run:
- `npm --prefix web run test`
- `npm --prefix web run typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

Use a conventional commit describing live provider activation.

- [ ] **Step 4: Push**

Push `feat/deepagents-foundation` to `origin`.

- [ ] **Step 5: Clean residual processes**

Stop any unnecessary `node`, `python`, and `git` processes started during verification.

