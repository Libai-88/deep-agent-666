# V29 Custom Provider GA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn custom providers into a restart-safe, diagnosable, and launchable local-first product capability.

**Architecture:** Extend the existing provider registry into a persisted runtime configuration layer, strengthen registry validation and model/provider invariants, then expose the missing GA product surfaces: richer provider/model editing, explicit provider probes, and diagnostics that understand custom providers. Keep dynamic presets as derived runtime views so the current workbench and thread model remain intact.

**Tech Stack:** FastAPI, Pydantic, Deep Agents, LangGraph, CopilotKit, Next.js 16, React 19, TypeScript, Vitest, Playwright, pytest

## Global Constraints

- Preserve the existing `deepagents + LangGraph + CopilotKit` backend stack.
- Keep custom providers constrained to `openai-compatible`.
- Do not build a generic provider plugin SDK.
- Do not claim arbitrary authentication plugin support beyond what the installed provider transports can actually honor.
- Treat API secrets as write-only in product surfaces.
- Preserve derived dynamic presets and the existing thread/workbench model.
- Update docs/status counts and commit incrementally as tasks land.

---

### Task 1: Persisted Provider Registry And Stronger Validation

**Files:**
- Modify: `agent/app/provider_registry.py`
- Modify: `agent/app/config.py`
- Modify: `agent/tests/test_provider_registry.py`
- Modify: `agent/tests/test_config_and_presets.py`

**Interfaces:**
- Consumes: existing `ProviderProfile`, `ModelProfile`, `ProviderRegistrySnapshot`, `ConfigStore`
- Produces: persisted registry path support, stronger registry normalization errors, stable registry validation codes

- [ ] **Step 1: Write failing backend tests for validation and persistence**

```python
def test_normalize_provider_registry_payload_rejects_duplicate_provider_ids(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    with pytest.raises(ValueError, match="duplicate provider id"):
        normalize_provider_registry_payload(
            {
                "workspaceRoot": str(workspace),
                "providerProfiles": [
                    {
                        "id": "lab-gateway",
                        "label": "Lab Gateway A",
                        "protocol": "openai-compatible",
                        "baseUrl": "https://gateway-a.example.com/v1",
                        "apiKey": "secret-a",
                        "authScheme": "bearer_token",
                        "enabled": True,
                    },
                    {
                        "id": "lab-gateway",
                        "label": "Lab Gateway B",
                        "protocol": "openai-compatible",
                        "baseUrl": "https://gateway-b.example.com/v1",
                        "apiKey": "secret-b",
                        "authScheme": "bearer_token",
                        "enabled": True,
                    },
                ],
                "modelProfiles": [],
            }
        )


def test_config_store_reloads_persisted_custom_registry(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    registry_path = tmp_path / "provider-registry.json"
    registry_path.write_text(
        json.dumps(
            {
                "workspaceRoot": str(workspace),
                "providerProfiles": [
                    {
                        "id": "lab-gateway",
                        "label": "Lab Gateway",
                        "protocol": "openai-compatible",
                        "baseUrl": "https://gateway.example.com/v1",
                        "apiKey": "secret",
                        "authScheme": "bearer_token",
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
        ),
        encoding="utf-8",
    )

    settings = AgentSettings.model_construct(
        workspace_root=workspace,
        openai_api_key=None,
        openai_base_url=None,
        anthropic_api_key=None,
        anthropic_base_url=None,
        google_api_key=None,
        google_base_url=None,
        provider_registry_path=registry_path,
    )

    store = ConfigStore(settings)

    snapshot = store.provider_registry_snapshot
    assert snapshot.provider_profiles[0].id == "lab-gateway"
    assert snapshot.provider_profiles[0].headers == {"X-Team": "chem"}
    assert snapshot.model_profiles[0].id == "lab-gpt5"
```

- [ ] **Step 2: Run targeted backend tests and confirm failure**

Run: `uv run --project agent pytest -v agent/tests/test_provider_registry.py agent/tests/test_config_and_presets.py`
Expected: FAIL because duplicate-ID validation and persisted registry loading do not exist yet.

- [ ] **Step 3: Implement persisted registry storage and validation**

```python
class AgentSettings(BaseSettings):
    provider_registry_path: Path = Field(
        default=Path("data/provider-registry.json"),
        alias="AGENT_PROVIDER_REGISTRY_PATH",
    )
```

```python
def validate_provider_registry_snapshot(
    snapshot: ProviderRegistrySnapshot,
) -> ProviderRegistrySnapshot:
    provider_ids: set[str] = set()
    model_ids: set[str] = set()

    for provider in snapshot.provider_profiles:
        if provider.id in provider_ids:
            raise ValueError(f"duplicate provider id: {provider.id}")
        provider_ids.add(provider.id)

    for model in snapshot.model_profiles:
        if model.id in model_ids:
            raise ValueError(f"duplicate model id: {model.id}")
        if model.provider_id not in provider_ids:
            raise ValueError(f"model references unknown provider: {model.provider_id}")
        model_ids.add(model.id)

    return snapshot
```

- [ ] **Step 4: Re-run targeted backend tests and confirm pass**

Run: `uv run --project agent pytest -v agent/tests/test_provider_registry.py agent/tests/test_config_and_presets.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add agent/app/provider_registry.py agent/app/config.py agent/tests/test_provider_registry.py agent/tests/test_config_and_presets.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(provider): persist registry and validate profiles"
```

### Task 2: Registry-Aware Runtime Payloads And Provider Probe Endpoint

**Files:**
- Modify: `agent/app/agent_factory.py`
- Modify: `agent/app/main.py`
- Modify: `agent/tests/test_live_provider_activation.py`
- Create: `agent/tests/test_provider_probe.py`

**Interfaces:**
- Consumes: persisted `ProviderRegistrySnapshot`, model-builder path, route error classification
- Produces: richer runtime config payloads, provider probe endpoint, header-aware model init kwargs

- [ ] **Step 1: Write failing backend tests for header-aware config payloads and provider probe**

```python
def test_config_snapshot_serializes_auth_scheme_and_headers(client):
    payload = client.get("/config").json()

    assert payload["providerProfiles"][0]["auth_scheme"] in {
        "api_key",
        "bearer_token",
    }
    assert "headers" in payload["providerProfiles"][0]


def test_provider_probe_returns_ready_for_stubbed_model(client, monkeypatch):
    monkeypatch.setattr("app.main.probe_provider_model", lambda *args, **kwargs: {
        "status": "ready",
        "code": None,
        "message": "ok",
    })

    response = client.post(
        "/providers/probe",
        json={
            "providerProfile": {
                "id": "lab-gateway",
                "label": "Lab Gateway",
                "protocol": "openai-compatible",
                "baseUrl": "https://gateway.example.com/v1",
                "apiKey": "secret",
                "authScheme": "bearer_token",
                "enabled": True,
                "headers": {"X-Team": "chem"},
            },
            "modelProfile": {
                "id": "lab-gpt5",
                "providerId": "lab-gateway",
                "modelName": "gpt-5.4",
                "label": "GPT 5.4",
                "capabilities": ["chat", "tools"],
                "isDefault": True,
                "enabled": True,
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
```

- [ ] **Step 2: Run targeted backend tests and confirm failure**

Run: `uv run --project agent pytest -v agent/tests/test_live_provider_activation.py agent/tests/test_provider_probe.py`
Expected: FAIL because config payloads do not expose richer provider fields and no probe endpoint exists yet.

- [ ] **Step 3: Implement header-aware runtime config and probe endpoint**

```python
def _build_model_kwargs(...):
    kwargs: dict[str, object] = {"api_key": api_key}
    if provider in {"openai"} and provider_profile and provider_profile.headers:
        kwargs["default_headers"] = provider_profile.headers
```

```python
@app.post("/providers/probe")
async def provider_probe(body: ProviderProbeRequest) -> JSONResponse:
    result = probe_provider_model(body.providerProfile, body.modelProfile)
    return JSONResponse(result)
```

- [ ] **Step 4: Re-run targeted backend tests and confirm pass**

Run: `uv run --project agent pytest -v agent/tests/test_live_provider_activation.py agent/tests/test_provider_probe.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add agent/app/agent_factory.py agent/app/main.py agent/tests/test_live_provider_activation.py agent/tests/test_provider_probe.py
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(provider): add probe endpoint and header-aware runtime config"
```

### Task 3: Frontend Runtime Settings Contract For GA

**Files:**
- Modify: `web/src/lib/runtime-settings.ts`
- Modify: `web/src/lib/__tests__/runtime-settings.test.ts`
- Modify: `web/src/app/api/runtime-config/route.ts`
- Modify: `web/src/app/api/runtime-config/route.test.ts`
- Create: `web/src/app/api/provider-probe/route.ts`
- Create: `web/src/app/api/provider-probe/route.test.ts`

**Interfaces:**
- Consumes: richer `/config`, `/configure`, `/providers/probe` backend payloads
- Produces: `authScheme`-aware runtime settings, provider probe proxy route, request builder support for headers/models/defaults

- [ ] **Step 1: Write failing frontend tests for richer provider settings and probe proxy**

```ts
it("normalizes auth scheme and headers on provider profiles", () => {
  const settings = normalizeRuntimeSettings({
    workspaceRoot: "D:\\AgentBuild",
    providerProfiles: [
      {
        id: "lab-gateway",
        label: "Lab Gateway",
        protocol: "openai-compatible",
        authScheme: "bearer_token",
        baseUrl: "https://gateway.example.com/v1",
        apiKeyPresent: true,
        enabled: true,
        headers: { "X-Team": "chem" },
      },
    ],
    modelProfiles: [],
  });

  expect(settings.providerProfiles[0]?.authScheme).toBe("bearer_token");
});
```

```ts
it("proxies provider probe requests to the backend", async () => {
  const { POST } = await import("./route");
  const response = await POST(
    new Request("http://127.0.0.1:3000/api/provider-probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerProfile: {}, modelProfile: {} }),
    }),
  );

  expect(fetchMock).toHaveBeenCalledWith(
    "http://127.0.0.1:8123/providers/probe",
    expect.objectContaining({ method: "POST" }),
  );
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Run targeted frontend tests and confirm failure**

Run: `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts src/app/api/provider-probe/route.test.ts`
Expected: FAIL because `authScheme` and probe proxy support do not exist yet.

- [ ] **Step 3: Implement runtime-settings GA fields and probe proxy**

```ts
export type RuntimeProviderProfile = {
  id: string;
  label: string;
  protocol: RuntimeProviderProtocol;
  authScheme: "api_key" | "bearer_token";
  baseUrl: string | null;
  apiKeyPresent: boolean;
  headers: Record<string, string>;
  enabled: boolean;
};
```

- [ ] **Step 4: Re-run targeted frontend tests and confirm pass**

Run: `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/app/api/runtime-config/route.test.ts src/app/api/provider-probe/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/src/lib/runtime-settings.ts web/src/lib/__tests__/runtime-settings.test.ts web/src/app/api/runtime-config/route.ts web/src/app/api/runtime-config/route.test.ts web/src/app/api/provider-probe/route.ts web/src/app/api/provider-probe/route.test.ts
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(web): extend runtime settings for provider ga"
```

### Task 4: Provider Registry Editor And Diagnostics Productization

**Files:**
- Modify: `web/src/components/ProviderRegistryEditor.tsx`
- Modify: `web/src/components/__tests__/ProviderRegistryEditor.test.tsx`
- Modify: `web/src/lib/runtime-diagnostics.ts`
- Modify: `web/src/lib/__tests__/runtime-diagnostics.test.ts`
- Modify: `web/src/components/RuntimeDiagnosticsDialog.tsx`
- Modify: `web/src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: richer runtime settings contract and same-origin probe route
- Produces: multi-model registry editor, header rows, enabled/default toggles, inline probe status, custom-provider diagnostics visibility

- [ ] **Step 1: Write failing UI tests for advanced editor behavior and diagnostics visibility**

```ts
it("renders auth scheme, headers, and default-model controls", () => {
  const html = renderToStaticMarkup(
    <ProviderRegistryEditor
      apiKeys={{}}
      providerProfiles={[
        {
          id: "lab-gateway",
          label: "Lab Gateway",
          protocol: "openai-compatible",
          authScheme: "bearer_token",
          baseUrl: "https://gateway.example.com/v1",
          apiKeyPresent: true,
          headers: { "X-Team": "chem" },
          enabled: true,
        },
      ]}
      modelProfiles={[
        {
          id: "lab-gpt5",
          providerId: "lab-gateway",
          modelName: "gpt-5.4",
          label: "GPT 5.4",
          capabilities: ["chat", "tools"],
          isDefault: true,
          enabled: true,
        },
      ]}
      probeState={{}}
      onProbe={vi.fn()}
      onProviderChange={vi.fn()}
      onModelChange={vi.fn()}
      onApiKeyChange={vi.fn()}
    />,
  );

  expect(html).toContain("Authentication");
  expect(html).toContain("Headers");
  expect(html).toContain("Default model");
});
```

- [ ] **Step 2: Run targeted frontend tests and confirm failure**

Run: `npm --prefix web run test -- src/components/__tests__/ProviderRegistryEditor.test.tsx src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx src/lib/__tests__/runtime-diagnostics.test.ts`
Expected: FAIL because advanced registry editing and custom-provider diagnostics visibility are missing.

- [ ] **Step 3: Implement registry editor and diagnostics upgrades**

```ts
type ProviderProbeState = Record<
  string,
  {
    status: "idle" | "pending" | "ready" | "auth_failed" | "access_denied" | "model_unavailable" | "unreachable" | "invalid_config";
    message: string | null;
    checkedAt: string | null;
  }
>;
```

- [ ] **Step 4: Re-run targeted frontend tests and confirm pass**

Run: `npm --prefix web run test -- src/components/__tests__/ProviderRegistryEditor.test.tsx src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx src/lib/__tests__/runtime-diagnostics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/src/components/ProviderRegistryEditor.tsx web/src/components/__tests__/ProviderRegistryEditor.test.tsx web/src/lib/runtime-diagnostics.ts web/src/lib/__tests__/runtime-diagnostics.test.ts web/src/components/RuntimeDiagnosticsDialog.tsx web/src/components/__tests__/RuntimeDiagnosticsDialog.test.tsx web/src/app/page.tsx
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(settings): productize custom provider ga surfaces"
```

### Task 5: Restart Proof, Browser Coverage, And Documentation

**Files:**
- Create: `web/tests/e2e/custom-provider-ga.spec.ts`
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes: persisted registry, advanced editor, provider probe UX, dynamic preset runtime
- Produces: browser proof for V29 and updated product/docs status

- [ ] **Step 1: Write the failing Playwright proof**

```ts
test("custom provider settings persist and stay launchable after refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /settings/i }).click();
  await page.getByRole("button", { name: /add provider/i }).click();
  await page.getByLabel("Provider label").fill("Lab Gateway");
  await page.getByLabel("Base URL").fill("https://gateway.example.com/v1");
  await page.getByLabel("API key").fill("secret");
  await page.getByLabel("Header key").fill("X-Team");
  await page.getByLabel("Header value").fill("chem");
  await page.getByLabel("Model name").fill("gpt-5.4");
  await page.getByRole("button", { name: /save/i }).click();
  await page.reload();

  await expect(page.getByDisplayValue("Lab Gateway")).toBeVisible();
  await expect(page.getByText(/stored key retained/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the targeted browser proof and confirm failure**

Run: `npm --prefix web run e2e -- custom-provider-ga.spec.ts`
Expected: FAIL because persistence/probe/advanced editor behavior is not fully implemented yet.

- [ ] **Step 3: Implement remaining browser wiring and docs updates**

```md
- `V29` should document persisted registry, advanced provider settings, probe UX, and restart-safe dynamic preset continuity as one GA milestone.
```

- [ ] **Step 4: Re-run the targeted browser proof and confirm pass**

Run: `npm --prefix web run e2e -- custom-provider-ga.spec.ts`
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
- Add the completed `V29` entry to `docs/superpowers/STATUS.md`
- Update `SUMMARY.md` with persisted registry, advanced provider settings, provider probe, and restart continuity outcomes
- Align `README.md` and `docs/superpowers/SPEC.md` with the GA custom-provider contract
```

- [ ] **Step 7: Commit and push**

```bash
git -C D:\AgentBuild\.worktrees\deepagents-foundation add web/tests/e2e/custom-provider-ga.spec.ts README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git -C D:\AgentBuild\.worktrees\deepagents-foundation commit -m "feat(v29): ship custom provider ga"
git -C D:\AgentBuild\.worktrees\deepagents-foundation push
```

## Self-Review

- Spec coverage: the plan covers persisted registry state, stronger validation, provider probe diagnostics, richer provider/model editing, restart-safe dynamic preset continuity, and docs.
- Placeholder scan: every task names concrete files, tests, commands, and interfaces.
- Type consistency: provider/model registry types, probe result types, and runtime settings payloads are introduced once and reused across backend routes, frontend settings, diagnostics, and browser verification.
