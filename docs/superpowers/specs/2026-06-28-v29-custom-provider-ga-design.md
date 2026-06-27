# V29 Custom Provider GA Design

## Goal

Ship `V29` as the phase that turns custom providers from a foundation feature into a stable local-first product capability: persisted across restarts, configurable with the fields the current runtime can actually honor, diagnosable before a real run fails, and safe to use through the existing preset/workbench model.

## Why This Phase Exists

`V28` completed the control-plane and custom-provider baseline:

- users can create an `openai-compatible` provider and custom model
- the backend derives dynamic presets from the provider registry
- the frontend no longer filters dynamic presets out of the catalog

That was the right first cut, but it is not yet GA quality.

The current gaps are structural:

- custom provider state is still process-local and disappears on restart
- the editor surface exposes only a narrow subset of the registry model
- there is no explicit preflight probe for provider/model connectivity
- diagnostics still center on built-in providers and do not explain custom-provider readiness well
- registry validation is permissive enough that malformed profiles can look saved long before they are truly launchable

If we stop at `V28`, the product still behaves like a demo wrapper around custom config rather than a dependable local agent runtime.

## Scope

`V29` is the “Custom Provider GA” phase. It includes four linked outcomes:

1. persisted provider/model registry state
2. advanced-yet-realistic provider/model configuration
3. explicit provider/model diagnostics and connection testing
4. stronger verification for dynamic preset launchability and restart continuity

This phase stays focused on making custom providers trustworthy. It does not attempt to solve multimodal ingestion, workflow composition, or arbitrary runtime rewind in the same batch.

## Non-Goals

- No generic provider plugin SDK.
- No support for arbitrary authentication plugins or request-signing schemes.
- No provider-side model auto-discovery API.
- No remote multi-user config sync.
- No new agent runtime stack; keep `deepagents + LangGraph + CopilotKit`.
- No expansion beyond the currently-supported custom protocol family: `openai-compatible`.

## Current Constraints In Code

The current baseline already exposes the core registry shapes:

- backend provider registry domain in [agent/app/provider_registry.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/provider_registry.py)
- runtime-mutable config store in [agent/app/config.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/config.py)
- live preset/agent derivation in [agent/app/runtime_registry.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/runtime_registry.py) and [agent/app/agent_factory.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/agent_factory.py)
- same-origin config proxy in [web/src/app/api/runtime-config/route.ts](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/app/api/runtime-config/route.ts)
- current registry UI in [web/src/components/ProviderRegistryEditor.tsx](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/components/ProviderRegistryEditor.tsx)
- runtime diagnostics model in [web/src/lib/runtime-diagnostics.ts](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/lib/runtime-diagnostics.ts)

The key limitations visible in current code are:

- `ConfigStore` keeps registry state in memory only
- `ProviderRegistryEditor` supports only a single shallow provider/model row pattern
- `RuntimeDiagnostics` only summarizes built-in provider readiness
- `ProviderProfile.auth_scheme` exists in the model but is not yet meaningfully productized
- registry validation does not yet enforce stronger invariants such as unique IDs, valid model/provider links, or a coherent enabled default model per provider

## Deep Agents Boundary

This phase must stay honest about what the current runtime can actually support.

Using the installed LangChain provider transports in this repo:

- `ChatOpenAI` supports `openai_api_key`, `openai_api_base`, and `default_headers`
- `ChatAnthropic` supports `anthropic_api_key`, `anthropic_api_url`, and `default_headers`
- `ChatGoogleGenerativeAI` supports `google_api_key`, `base_url`, and `additional_headers`

Practical consequence:

- static headers are a real feature we can ship now
- token-based auth is a real feature we can ship now
- arbitrary “custom auth scheme” behavior is not a real feature we can ship honestly in this stack without dropping below the current model-init path

Therefore `V29` should productize `auth_scheme` only within the safe subset the runtime can truly honor:

- `openai` / `openai-compatible`: bearer-token style secret via provider API key field, plus optional static headers
- `anthropic`: provider API key field, plus optional static headers
- `google`: provider API key field, plus optional static headers

The product may still store and display `auth_scheme`, but the allowed values must map directly to runtime behavior we can prove.

## Approach Options

### Option A: UI-only polish

Add more fields to the editor, keep in-memory store, and rely on runtime errors for validation.

Pros:

- fastest apparent progress

Cons:

- not GA
- restart wipes state
- provider failures remain reactive and opaque

### Option B: Persistence only

Persist the registry and leave the rest of the product largely unchanged.

Pros:

- solves the most dangerous reliability gap

Cons:

- users still cannot confidently debug or maintain custom providers
- malformed configs still look deceptively healthy

### Option C: Full GA hardening around the existing registry

Add persistence, validation, diagnostics/probe, richer editing, and restart proof while keeping the existing runtime abstraction.

Pros:

- resolves the real trust gap
- matches current product maturity better than another exploratory feature
- stays within the actual deep-agents boundary

Cons:

- broader than a simple editor enhancement

### Recommendation

Choose Option C.

This is the smallest phase that makes custom providers operationally credible rather than merely configurable.

## Product Design

### 1. Persisted Registry

The provider/model registry must survive backend restarts.

Requirements:

- runtime configuration changes made through `/configure` persist to a local JSON file
- persisted state reloads during backend startup
- persisted custom providers, custom models, workspace root changes, and built-in provider overrides rehydrate the live runtime registry automatically
- invalid persisted files must not crash startup; the backend should log and fall back to environment/bootstrap settings

Persistence is local-first product infrastructure, not an optional enhancement.

### 2. Provider Configuration Surface

The provider editor must support the fields the runtime can actually honor:

- provider label
- provider ID
- protocol
- base URL
- enabled/disabled state
- auth scheme
- secret presence / secret replacement
- static headers

For built-in providers:

- protocol stays fixed
- auth scheme is visible but not arbitrarily editable

For custom providers:

- protocol remains constrained to `openai-compatible`
- auth scheme remains constrained to the subset the runtime can honor for that transport

Secrets remain write-only in product UX.

### 3. Model Management Surface

Users must be able to manage more than one model under a provider.

Requirements:

- add/remove model rows under a provider
- edit model ID, label, model name, capabilities, enabled state
- choose exactly one default enabled model per provider
- prevent saving a provider with zero enabled defaultable models if that provider itself is enabled and expected to launch presets

The product still launches through derived presets, but users should not need to reverse-engineer preset IDs to understand their model configuration.

### 4. Provider Probe And Diagnostics

The product should not wait for a full task run to reveal obvious configuration problems.

Add an explicit provider/model probe action that:

- validates the selected provider/model profile server-side
- instantiates the same runtime model stack the preset will use
- performs a bounded connectivity check
- classifies failures into stable user-facing codes

Expected output categories:

- `ready`
- `auth_failed`
- `access_denied`
- `model_unavailable`
- `unreachable`
- `invalid_config`

The frontend should surface this result inline in Settings and also expose enough registry summary in runtime diagnostics to explain custom-provider readiness.

### 5. Launchability And Recovery Semantics

`V29` must prove that a valid custom provider is not just saved, but launchable and recoverable.

This includes:

- dynamic preset derivation from the persisted registry
- same-origin runtime config fetch after refresh
- thread/preset restoration continuing to accept dynamic preset IDs
- backend restart continuity for saved provider/model registry state

## Backend Design

### Registry Persistence Layer

Extend runtime config storage with a persisted provider-registry file.

Recommended implementation:

- add a configurable registry-state path, defaulting to a local `data/provider-registry.json`
- teach `ConfigStore` to load persisted snapshot state during initialization
- rewrite the file atomically whenever workspace root, built-in provider settings, or custom registry entries change

The persisted file should store:

- workspace root
- provider profiles
- model profiles

It should not store derived presets.

### Stronger Registry Validation

Strengthen normalization/validation rules in the backend registry domain:

- provider IDs must be unique
- model IDs must be unique
- each model must reference an existing provider
- enabled providers must have at least one enabled model
- each provider may have at most one enabled default model
- built-in provider IDs may not be redefined as custom providers with conflicting protocol
- auth schemes must be valid for the provider protocol

Validation errors should return stable machine-readable codes instead of collapsing into workspace-root errors.

### Runtime Construction

`agent_factory.py` should evolve from “base URL + API key only” to registry-aware transport kwargs:

- `openai` / `openai-compatible`: map static headers into `default_headers`
- `anthropic`: map static headers into `default_headers`
- `google`: map static headers into `additional_headers`

Do not claim arbitrary auth-plugin support. Only map fields that the runtime demonstrably honors.

### Provider Probe Endpoint

Add a backend route dedicated to provider/model verification.

The route should:

- accept a provider profile plus a target model profile
- reuse the same model builder path as runtime launch
- perform a bounded probe call
- classify exceptions using the same failure taxonomy the frontend already understands where possible

This route is explicit product infrastructure for `V29`.

## Frontend Design

### Runtime Settings Contract

Extend runtime settings types and request builders to include:

- `authScheme`
- richer header payloads
- provider `enabled`
- model `enabled`
- model `label`
- model `capabilities`

Normalization should keep camelCase and snake_case compatibility.

### Provider Registry Editor

Refactor the current editor from a shallow card list into a real registry surface:

- add/remove provider
- add/remove model
- change default model
- edit static headers as key/value rows
- show provider enabled state
- show model enabled state
- trigger provider probe
- show last probe result inline

This should remain inside the existing Settings flow rather than becoming a separate page.

### Runtime Diagnostics

Extend diagnostics to include custom provider visibility.

At minimum diagnostics should explain:

- how many registry-backed providers exist
- how many are enabled
- whether each provider has credentials present
- which default model is selected
- whether the latest probe succeeded or failed, when available

The existing built-in provider summary should remain, but it is no longer enough on its own once custom providers are a first-class feature.

## Data Flow

1. Backend starts and loads environment settings.
2. Backend overlays any persisted provider-registry state and rebuilds the live runtime registry.
3. Frontend loads runtime config through the same-origin route and normalizes the persisted registry snapshot.
4. User edits provider/model settings and saves through `/api/runtime-config`.
5. Backend validates, persists, rebuilds runtime registry, and returns a normalized snapshot.
6. Frontend refreshes preset catalog and diagnostics from the rebuilt runtime.
7. User optionally probes a provider/model before launch through a same-origin probe route.
8. A successful probe or run confirms launchability for derived dynamic presets.

## Testing Strategy

### Backend

- provider registry validation tests
- persisted registry load/save tests
- runtime config route tests for persistence and stable validation codes
- provider probe route tests with stubbed model calls
- live preset derivation tests from persisted custom providers

### Frontend Unit

- runtime settings normalization for new provider/model fields
- editor interaction tests for multi-model/default/header editing
- diagnostics normalization tests for custom provider visibility
- probe route proxy tests

### Browser

- configure a custom provider with headers, multiple models, and a default model, save, refresh, and verify state persists
- verify an inline provider probe success/failure surface
- launch a dynamic preset after save
- verify dynamic preset continuity after backend restart or module reload proof

## Risks

- persistence can accidentally desynchronize built-in env-backed providers and custom registry entries unless one source of truth is made explicit
- auth scheme can become misleading if the UI implies arbitrary custom auth behavior the runtime does not really support
- a provider probe can become slow or flaky unless bounded and clearly user-triggered
- [web/src/app/page.tsx](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/app/page.tsx) remains a large integration surface and should be decomposed carefully while landing richer settings behavior

## Verification

- Focused backend:
  - `uv run --project agent pytest -v agent/tests/test_provider_registry.py agent/tests/test_config_and_presets.py agent/tests/test_live_provider_activation.py`
- Focused frontend:
  - `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/components/__tests__/ProviderRegistryEditor.test.tsx src/app/api/runtime-config/route.test.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
