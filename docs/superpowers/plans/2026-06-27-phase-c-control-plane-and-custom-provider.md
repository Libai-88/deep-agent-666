# Phase C Control Plane And Custom Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next product phase as one control-plane program: add custom provider/model registry support first, then layer transparent run controls and human takeover surfaces onto the workbench without breaking the existing unified runtime protocol.

**Architecture:** Refactor runtime configuration from fixed provider slots into a persisted provider/model registry, derive launchable presets from that registry, then add a normalized run-control state and workbench control UI that reuse the Phase A event pipeline. Keep the first version intentionally narrow by supporting built-in providers plus `openai-compatible`, and by constraining plan editing to paused coordinator boundaries.

**Tech Stack:** FastAPI, Pydantic, Deep Agents, LangGraph, CopilotKit, Next.js 16, React 19, TypeScript, Vitest, Playwright, pytest

## Global Constraints

- Preserve the existing `deepagents + LangGraph + CopilotKit` backend stack.
- Preserve the Phase A shared workbench event protocol as the primary timeline/artifact input.
- Support built-in `openai`, `anthropic`, `google`, plus custom `openai-compatible` in the first provider-registry version.
- Do not build a generic provider plugin SDK in this phase.
- Treat API secrets as write-only in product surfaces.
- Keep coordinator eligibility restricted to permission modes that already map to balanced/full-access semantics.
- Keep plan editing constrained to paused coordinator boundaries; do not claim arbitrary graph rewind.
- Update docs/status counts and commit incrementally as tasks land.

---

### Task 1: Backend Provider Registry Domain

**Files:**
- Create: `agent/app/provider_registry.py`
- Create: `agent/tests/test_provider_registry.py`
- Modify: `agent/app/config.py`
- Modify: `agent/app/presets.py`

**Interfaces:**
- Consumes: existing runtime settings env bootstrap from `AgentSettings`
- Produces: `ProviderProfile`, `ModelProfile`, `ProviderRegistrySnapshot`, `load_provider_registry_from_settings()`, `normalize_provider_registry_payload()`

- [ ] **Step 1: Write the failing backend tests**

```python
from app.provider_registry import (
    load_provider_registry_from_settings,
    normalize_provider_registry_payload,
)
from app.config import AgentSettings


def test_load_provider_registry_from_legacy_settings_builds_builtin_profiles(tmp_path):
    settings = AgentSettings.model_construct(
        workspace_root=tmp_path,
        openai_api_key="sk-openai",
        openai_base_url="https://api.openai.com/v1",
        anthropic_api_key=None,
        anthropic_base_url=None,
        google_api_key=None,
        google_base_url=None,
    )

    snapshot = load_provider_registry_from_settings(settings)

    assert [provider.id for provider in snapshot.provider_profiles] == ["openai"]
    assert snapshot.provider_profiles[0].protocol == "openai"
    assert snapshot.model_profiles[0].provider_id == "openai"
    assert snapshot.model_profiles[0].is_default is True


def test_normalize_provider_registry_payload_accepts_custom_openai_compatible():
    payload = normalize_provider_registry_payload(
        {
            "workspaceRoot": "D:/AgentBuild",
            "providerProfiles": [
                {
                    "id": "lab-gateway",
                    "label": "Lab Gateway",
                    "protocol": "openai-compatible",
                    "baseUrl": "https://gateway.example.com/v1",
                    "apiKey": "secret",
                    "enabled": True,
                    "headers": {"X-Team": "chem"},
                }
            ],
            "modelProfiles": [
                {
                    "id": "lab-gpt5",
                    "providerId": "lab-gateway",
                    "modelName": "gpt-5.4",
                    "label": "GPT 5.4",
                    "capabilities": ["chat", "tools"],
                    "isDefault": True,
                    "enabled": True,
                }
            ],
        }
    )

    assert payload.provider_profiles[0].protocol == "openai-compatible"
    assert payload.model_profiles[0].model_name == "gpt-5.4"
```

- [ ] **Step 2: Run the targeted backend tests and confirm failure**

Run: `uv run --project agent pytest -v agent/tests/test_provider_registry.py`
Expected: FAIL with import or attribute errors for missing provider registry module/functions.

- [ ] **Step 3: Implement the provider registry domain**

```python
from pydantic import BaseModel, Field


class ProviderProfile(BaseModel):
    id: str
    label: str
    protocol: str
    base_url: str | None = None
    auth_scheme: str = "api_key"
    api_key: str | None = Field(default=None, repr=False)
    headers: dict[str, str] = Field(default_factory=dict)
    enabled: bool = True

    @property
    def api_key_present(self) -> bool:
        return bool(self.api_key)


class ModelProfile(BaseModel):
    id: str
    provider_id: str
    model_name: str
    label: str
    capabilities: list[str] = Field(default_factory=list)
    is_default: bool = False
    enabled: bool = True
```

- [ ] **Step 4: Re-run the targeted backend tests and confirm pass**

Run: `uv run --project agent pytest -v agent/tests/test_provider_registry.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add agent/app/provider_registry.py agent/tests/test_provider_registry.py agent/app/config.py agent/app/presets.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(provider): add runtime provider registry domain"
```

### Task 2: Backend Runtime Registry And Config Route Migration

**Files:**
- Modify: `agent/app/runtime_registry.py`
- Modify: `agent/app/agent_factory.py`
- Modify: `agent/app/main.py`
- Modify: `agent/tests/test_config_and_presets.py`
- Modify: `agent/tests/test_live_provider_activation.py`

**Interfaces:**
- Consumes: `ProviderRegistrySnapshot`, current coordinator builder
- Produces: derived preset resolution from registry, `/config` and `/configure` registry snapshot payloads, live rebuild behavior for custom providers/models

- [ ] **Step 1: Write the failing backend tests for config snapshot and live preset derivation**

```python
def test_config_snapshot_returns_provider_and_model_profiles(client):
    response = client.get("/config")

    assert response.status_code == 200
    payload = response.json()
    assert "providerProfiles" in payload
    assert "modelProfiles" in payload


def test_configure_custom_openai_compatible_provider_creates_launchable_presets(client):
    response = client.post(
        "/configure",
        json={
            "providerProfiles": [
                {
                    "id": "lab-gateway",
                    "label": "Lab Gateway",
                    "protocol": "openai-compatible",
                    "baseUrl": "https://gateway.example.com/v1",
                    "apiKey": "secret",
                    "enabled": True,
                }
            ],
            "modelProfiles": [
                {
                    "id": "lab-gpt5",
                    "providerId": "lab-gateway",
                    "modelName": "gpt-5.4",
                    "label": "GPT 5.4",
                    "capabilities": ["chat", "tools"],
                    "isDefault": True,
                    "enabled": True,
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert any(preset_id.startswith("lab-gateway-") for preset_id in payload["preset_ids"])
```

- [ ] **Step 2: Run the targeted backend tests and confirm failure**

Run: `uv run --project agent pytest -v agent/tests/test_config_and_presets.py agent/tests/test_live_provider_activation.py`
Expected: FAIL because config payloads and runtime registry are still fixed to legacy provider slots.

- [ ] **Step 3: Implement registry-aware runtime rebuild and config payloads**

```python
class ConfigureRequest(BaseModel):
    agent_workspace_root: str | None = None
    provider_profiles: list[dict[str, object]] | None = None
    model_profiles: list[dict[str, object]] | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    google_api_key: str | None = None
    google_base_url: str | None = None


def _runtime_config_payload() -> dict[str, object]:
    snapshot = store.snapshot()
    registry = store.provider_registry_snapshot
    return {
        "workspaceRoot": str(snapshot.workspace_root),
        "providerProfiles": [profile.model_dump(exclude={"api_key"}) for profile in registry.provider_profiles],
        "modelProfiles": [profile.model_dump() for profile in registry.model_profiles],
        "providers": registry.to_legacy_provider_summary(),
    }
```

- [ ] **Step 4: Re-run the targeted backend tests and confirm pass**

Run: `uv run --project agent pytest -v agent/tests/test_config_and_presets.py agent/tests/test_live_provider_activation.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add agent/app/runtime_registry.py agent/app/agent_factory.py agent/app/main.py agent/tests/test_config_and_presets.py agent/tests/test_live_provider_activation.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(runtime): derive presets from provider registry"
```

### Task 3: Frontend Runtime Settings And Settings Surface Refactor

**Files:**
- Create: `web/src/components/ProviderRegistryEditor.tsx`
- Create: `web/src/components/__tests__/ProviderRegistryEditor.test.tsx`
- Modify: `web/src/lib/runtime-settings.ts`
- Modify: `web/src/lib/__tests__/runtime-settings.test.ts`
- Modify: `web/src/app/api/runtime-config/route.test.ts`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `/api/runtime-config` registry payload
- Produces: `RuntimeProviderProfile`, `RuntimeModelProfile`, registry-aware request body builder, settings UI for adding/editing providers and models

- [ ] **Step 1: Write the failing frontend tests for registry normalization and editor behavior**

```ts
import { buildRuntimeConfigRequestBody, normalizeRuntimeSettings } from "@/lib/runtime-settings";

it("normalizes provider and model profiles from runtime config", () => {
  const settings = normalizeRuntimeSettings({
    workspaceRoot: "D:/AgentBuild",
    providerProfiles: [
      {
        id: "lab-gateway",
        label: "Lab Gateway",
        protocol: "openai-compatible",
        baseUrl: "https://gateway.example.com/v1",
        enabled: true,
        apiKeyPresent: true,
        headers: { "X-Team": "chem" },
      },
    ],
    modelProfiles: [
      {
        id: "lab-gpt5",
        providerId: "lab-gateway",
        modelName: "gpt-5.4",
        label: "GPT 5.4",
        capabilities: ["chat", "tools"],
        isDefault: true,
        enabled: true,
      },
    ],
  });

  expect(settings.providerProfiles[0]?.protocol).toBe("openai-compatible");
  expect(settings.modelProfiles[0]?.modelName).toBe("gpt-5.4");
});

it("builds registry payloads for custom providers and models", () => {
  const payload = buildRuntimeConfigRequestBody({
    workspaceRoot: "D:/AgentBuild",
    providerProfiles: [
      {
        id: "lab-gateway",
        label: "Lab Gateway",
        protocol: "openai-compatible",
        baseUrl: "https://gateway.example.com/v1",
        apiKey: "secret",
        enabled: true,
        headers: { "X-Team": "chem" },
      },
    ],
    modelProfiles: [
      {
        id: "lab-gpt5",
        providerId: "lab-gateway",
        modelName: "gpt-5.4",
        label: "GPT 5.4",
        capabilities: ["chat", "tools"],
        isDefault: true,
        enabled: true,
      },
    ],
  });

  expect(payload.providerProfiles[0].protocol).toBe("openai-compatible");
  expect(payload.modelProfiles[0].providerId).toBe("lab-gateway");
});
```

- [ ] **Step 2: Run the targeted frontend tests and confirm failure**

Run: `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts src/components/__tests__/ProviderRegistryEditor.test.tsx`
Expected: FAIL because runtime settings and settings UI still only support three fixed providers.

- [ ] **Step 3: Implement registry-aware runtime settings and settings editor**

```ts
export type RuntimeProviderProfile = {
  id: string;
  label: string;
  protocol: "openai" | "anthropic" | "google" | "openai-compatible";
  baseUrl: string | null;
  apiKeyPresent: boolean;
  headers: Record<string, string>;
  enabled: boolean;
};

export type RuntimeModelProfile = {
  id: string;
  providerId: string;
  modelName: string;
  label: string;
  capabilities: Array<"chat" | "tools" | "vision" | "long_context">;
  isDefault: boolean;
  enabled: boolean;
};
```

- [ ] **Step 4: Re-run the targeted frontend tests and confirm pass**

Run: `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts src/components/__tests__/ProviderRegistryEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/src/components/ProviderRegistryEditor.tsx web/src/components/__tests__/ProviderRegistryEditor.test.tsx web/src/lib/runtime-settings.ts web/src/lib/__tests__/runtime-settings.test.ts web/src/app/api/runtime-config/route.test.ts web/src/app/page.tsx
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(web): add provider registry settings editor"
```

### Task 4: Run Control State And Workbench Actions

**Files:**
- Create: `web/src/lib/run-control-state.ts`
- Create: `web/src/lib/__tests__/run-control-state.test.ts`
- Create: `web/src/components/RunControlBar.tsx`
- Create: `web/src/components/__tests__/RunControlBar.test.tsx`
- Modify: `web/src/lib/runtime-errors.ts`
- Modify: `web/src/app/page.tsx`
- Modify: `agent/app/main.py`
- Modify: `agent/tests/test_v2_endpoints.py`

**Interfaces:**
- Consumes: workbench events, recoverable error state, active thread context
- Produces: `RunControlState`, `resolveRunControlState()`, stop/retry/resume/edit-plan actions, workbench control bar rendering

- [ ] **Step 1: Write the failing tests for run-control state and action visibility**

```ts
import { resolveRunControlState } from "@/lib/run-control-state";

it("exposes stop while a run is active", () => {
  const state = resolveRunControlState({
    threadId: "thread-1",
    runStatus: "running",
    currentStep: "Writing code",
    activeProviderId: "lab-gateway",
    activeModelId: "lab-gpt5",
    recoverableError: null,
    lastRecoverablePrompt: "fix the bug",
  });

  expect(state.availableActions).toContain("stop");
});

it("exposes resume and edit_plan when paused for approval", () => {
  const state = resolveRunControlState({
    threadId: "thread-1",
    runStatus: "waiting_approval",
    currentStep: "Planner review",
    activeProviderId: "openai",
    activeModelId: "openai-default",
    recoverableError: null,
    lastRecoverablePrompt: "review the plan",
  });

  expect(state.availableActions).toEqual(expect.arrayContaining(["resume", "edit_plan"]));
});
```

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run: `npm --prefix web run test -- src/lib/__tests__/run-control-state.test.ts src/components/__tests__/RunControlBar.test.tsx`
Expected: FAIL because no run-control state or control bar exists yet.

- [ ] **Step 3: Implement normalized run-control state and workbench bar**

```ts
export type RunControlAction = "stop" | "retry" | "resume" | "edit_plan";

export type RunControlState = {
  threadId: string | null;
  runId: string | null;
  status: "idle" | "running" | "waiting_approval" | "stopped" | "failed" | "completed";
  currentStep: string | null;
  availableActions: RunControlAction[];
  pendingApproval: boolean;
  lastRecoverablePrompt: string | null;
  activeProviderId: string | null;
  activeModelId: string | null;
};
```

- [ ] **Step 4: Re-run the targeted tests and confirm pass**

Run: `npm --prefix web run test -- src/lib/__tests__/run-control-state.test.ts src/components/__tests__/RunControlBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/src/lib/run-control-state.ts web/src/lib/__tests__/run-control-state.test.ts web/src/components/RunControlBar.tsx web/src/components/__tests__/RunControlBar.test.tsx web/src/lib/runtime-errors.ts web/src/app/page.tsx agent/app/main.py agent/tests/test_v2_endpoints.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(control): add workbench run control state"
```

### Task 5: Timeline Language And Coordinator Plan Editing Boundary

**Files:**
- Create: `web/src/components/PlanEditorPanel.tsx`
- Create: `web/src/components/__tests__/PlanEditorPanel.test.tsx`
- Modify: `web/src/lib/runtime-events.ts`
- Modify: `web/src/lib/tool-result-normalizer.ts`
- Modify: `web/src/components/TaskTimelinePanel.tsx`
- Modify: `agent/app/state.py`
- Modify: `agent/app/agent_factory.py`
- Modify: `agent/tests/test_v2_state.py`
- Modify: `agent/tests/test_v2_genui.py`

**Interfaces:**
- Consumes: coordinator workbench events and paused control state
- Produces: normalized user-facing timeline statuses, constrained plan-edit submission surface for paused coordinator runs

- [ ] **Step 1: Write the failing tests for timeline language and plan-edit availability**

```ts
it("maps runtime activity to user-facing timeline copy", () => {
  const events = normalizeSnapshotEvents([
    {
      kind: "status",
      status: "running",
      title: "executor started",
      message: "replace text in file",
      source: "executor",
    },
  ]);

  expect(events[0]?.title).toContain("Writing");
});
```

```python
def test_coordinator_state_marks_editable_pause_boundary():
    state = {
        "workbench_events": [],
        "delegations": [],
        "task_kind": "engineering",
        "final_summary": "",
        "control_state": {
            "status": "waiting_approval",
            "current_step": "Planner review",
            "available_actions": ["resume", "edit_plan"],
        },
    }

    assert state["control_state"]["available_actions"] == ["resume", "edit_plan"]
```

- [ ] **Step 2: Run the targeted tests and confirm failure**

Run: `npm --prefix web run test -- src/components/__tests__/PlanEditorPanel.test.tsx src/components/__tests__/TaskTimelinePanel.test.tsx`
Expected: FAIL because plan editor and revised timeline labels are missing.

- [ ] **Step 3: Implement paused-boundary plan editing and normalized timeline copy**

```python
class CoordinatorControlState(TypedDict, total=False):
    status: str
    current_step: str
    available_actions: list[str]
    pending_approval: bool
```

- [ ] **Step 4: Re-run the targeted tests and confirm pass**

Run: `npm --prefix web run test -- src/components/__tests__/PlanEditorPanel.test.tsx src/components/__tests__/TaskTimelinePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/src/components/PlanEditorPanel.tsx web/src/components/__tests__/PlanEditorPanel.test.tsx web/src/lib/runtime-events.ts web/src/lib/tool-result-normalizer.ts web/src/components/TaskTimelinePanel.tsx agent/app/state.py agent/app/agent_factory.py agent/tests/test_v2_state.py agent/tests/test_v2_genui.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(control): add paused plan editing boundary"
```

### Task 6: Browser Proof, Docs, Verification, And Push

**Files:**
- Create: `web/tests/e2e/custom-provider-run-control.spec.ts`
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: provider registry settings, run-control UI, timeline language
- Produces: end-to-end proof for custom provider configuration and in-workbench run control, updated docs/status

- [ ] **Step 1: Write the failing Playwright proof**

```ts
test("custom provider settings and run control stay visible in one workbench flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /settings/i }).click();
  await page.getByLabel("Add provider").click();
  await page.getByLabel("Provider label").fill("Lab Gateway");
  await page.getByLabel("Protocol").selectOption("openai-compatible");
  await page.getByLabel("Base URL").fill("https://gateway.example.com/v1");
  await page.getByLabel("API key").fill("secret");
  await page.getByLabel("Model name").fill("gpt-5.4");
  await page.getByRole("button", { name: /save/i }).click();

  await expect(page.getByTestId("runtime-status-badge")).toBeVisible();
  await expect(page.getByTestId("run-control-bar")).toBeVisible();
});
```

- [ ] **Step 2: Run the targeted E2E proof and confirm failure**

Run: `npm --prefix web run e2e -- custom-provider-run-control.spec.ts`
Expected: FAIL because registry UI and run-control surfaces are not fully implemented yet.

- [ ] **Step 3: Implement any remaining UI/test-id wiring and documentation updates**

```md
- V28 should document provider registry support and run-control surfaces together because they share one control-plane architecture.
```

- [ ] **Step 4: Re-run the targeted E2E proof and confirm pass**

Run: `npm --prefix web run e2e -- custom-provider-run-control.spec.ts`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `npm --prefix web run typecheck`
Expected: PASS

Run: `npm --prefix web run test`
Expected: PASS

Run: `npm --prefix web run build`
Expected: PASS

Run: `npm --prefix web run e2e`
Expected: PASS

Run: `uv run --project agent pytest -v`
Expected: PASS

- [ ] **Step 6: Update docs and counts**

```md
- Add the completed phase/status entry to `docs/superpowers/STATUS.md`
- Update `SUMMARY.md` with custom provider/model and run-control outcomes
- Align `README.md` and `docs/superpowers/SPEC.md` with the new runtime config model
```

- [ ] **Step 7: Commit and push**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/tests/e2e/custom-provider-run-control.spec.ts README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(phase-c): add control plane and custom provider foundation"
git -C D:\AgentBuild\.worktrees\deepagents-foundation push
```

## Self-Review

- Spec coverage: the plan covers provider registry domain, registry-driven preset derivation, frontend settings refactor, run-control state/UI, paused plan editing boundary, browser proof, and docs.
- Placeholder scan: every task names concrete files, tests, commands, and interfaces.
- Type consistency: provider/model registry types are introduced once and then reused across backend config, frontend settings, and runtime control surfaces.
