# Phase C Control Plane And Custom Provider Design

## Goal

Advance the product into `Phase C` by making agent execution transparent and interruptible in-product, while front-loading the provider/model access layer so the workbench can run against user-defined upstreams instead of only hard-coded provider slots.

## Why This Matters

Phase A unified the runtime event protocol, but the product still has two structural limits:

- users cannot reliably see and control a live run beyond coarse recoverable-error actions
- the runtime still assumes a fixed `openai / anthropic / google` configuration model

That leaves the product in an awkward middle state:

- it looks like a general-purpose agent workbench
- but it still behaves like a thin demo wrapper around a small preset catalog

The next phase should resolve both constraints through one shared control plane. Execution transparency and custom provider/model support are not separate products. They both depend on a stable runtime contract that can describe:

- what is running now
- what the user can do to that run now
- which provider/model binding that run is using

## Scope

This phase is one delivery stream with two linked tracks:

1. `Phase C mainline`: execution transparency and human takeover
2. `Phase B front-loaded subproject`: custom provider and custom model support

The implementation should treat them as one control-plane program, not as unrelated settings work plus unrelated timeline work.

## Non-Goals

- No visual low-code workflow builder in this phase.
- No fully generic provider plugin SDK.
- No guaranteed universal `undo` for arbitrary side effects.
- No deep multimodal ingestion pipeline in the same implementation batch.
- No attempt to replace the current `deepagents + LangGraph + CopilotKit` runtime stack.

## Current Constraints In Code

The current repo has the following coupling points:

- backend runtime config is hard-coded in [agent/app/config.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/config.py)
- preset availability is derived from fixed provider keys in [agent/app/agent_factory.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/agent_factory.py) and [agent/app/presets.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/presets.py)
- runtime registry only builds agents from that fixed preset map in [agent/app/runtime_registry.py](D:/AgentBuild/.worktrees/deepagents-foundation/agent/app/runtime_registry.py)
- frontend settings only know how to edit three provider slots in [web/src/app/page.tsx](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/app/page.tsx)
- runtime settings shape is fixed to three providers in [web/src/lib/runtime-settings.ts](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/lib/runtime-settings.ts)
- recoverable actions currently stop at diagnostics/settings/retry and do not expose a richer run-control surface in [web/src/lib/runtime-errors.ts](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/lib/runtime-errors.ts)

This phase should break those couplings without destabilizing the current Phase A event protocol.

## Approach Options

### Option A: Do pure Phase C first, leave provider/model access for later

Pros:

- smaller immediate scope
- easier to demo timeline and stop/retry controls quickly

Cons:

- keeps the product blocked on fixed provider slots
- forces the next phase to reopen the same runtime config and preset surfaces
- risks building run controls around assumptions that break once provider/model binding becomes dynamic

### Option B: Do custom providers first, delay run controls

Pros:

- removes the biggest adoption blocker for real-world usage
- simplifies testing with user-owned upstreams

Cons:

- does not improve the product’s black-box execution problem
- leaves the workbench feeling operationally weak even after a major config refactor

### Option C: Build one shared control plane, then expose provider/model management first and richer run controls immediately after

Pros:

- one architecture supports both concerns
- runtime state, user actions, and provider/model binding stay coherent
- avoids duplicating config, registry, and workbench plumbing

Cons:

- requires tighter decomposition discipline

### Recommendation

Choose Option C.

This is the smallest architecture that solves the real product bottleneck rather than just moving it.

## Product Design

### Track 1: Provider And Model Access Layer

The product must move from fixed provider slots to a provider registry.

Users should be able to:

- create a provider profile
- choose a supported protocol
- set `base URL`
- set secret/auth material
- optionally define static headers
- add one or more models under that provider
- choose a default model per provider
- map those provider/model bindings into launchable agent presets

First version protocol support should be intentionally narrow:

- built-in `openai`
- built-in `anthropic`
- built-in `google`
- generic `openai-compatible`

This gives the product real custom upstream support without pretending to already have a universal provider plugin platform.

### Track 2: Run Transparency And Human Takeover

The workbench must expose live execution state as first-class product UI, not just as side effects of messages and tool cards.

Users should be able to:

- see the current run status
- see the current step or waiting point
- stop a live run
- retry the last recoverable run
- resume approval-gated work
- edit the plan before the next execution stage when the runtime is waiting on a controllable boundary

First version plan editing should be constrained:

- only supported for coordinator-style flows
- only supported when the run is paused on a planner/reviewer boundary
- implemented as “submit revised execution instructions” rather than arbitrary graph surgery

That keeps the feature real while staying within the practical control surface of the current backend stack.

## Architecture

### 1. Provider Registry

Add a backend registry layer that stores normalized provider definitions independent of agent presets.

Core object:

- `ProviderProfile`
  - `id`
  - `label`
  - `protocol`
  - `base_url`
  - `auth_scheme`
  - `api_key_present`
  - `headers`
  - `enabled`

This registry should become the source of truth for runtime configuration.

### 2. Model Catalog

Add a sibling model layer that hangs off provider profiles.

Core object:

- `ModelProfile`
  - `id`
  - `provider_id`
  - `model_name`
  - `label`
  - `capabilities`
  - `is_default`
  - `enabled`

Capabilities should stay small in v1:

- `chat`
- `tools`
- `vision`
- `long_context`

No marketplace semantics, ranking systems, or provider-side discovery APIs are required in this phase.

### 3. Runtime Preset Resolver

Replace the fixed preset derivation path with a resolver that can build launchable presets from:

- built-in provider/model defaults
- custom `openai-compatible` providers
- permission mode templates
- coordinator eligibility rules

The product should preserve the familiar preset experience, but presets become derived runtime views, not hard-coded static truth.

### 4. Run Control Plane

Add a normalized run-control state that is independent of chat rendering.

Core object:

- `RunControlState`
  - `thread_id`
  - `run_id`
  - `status`
  - `current_step`
  - `available_actions`
  - `pending_approval`
  - `last_recoverable_prompt`
  - `active_provider_id`
  - `active_model_id`

This state should be derived from runtime events plus local thread context, then exposed to the frontend through the existing workbench shell.

### 5. Workbench Control UI

The frontend should separate:

- provider/model management
- live run controls
- timeline rendering
- plan editing

This avoids repeating the current pattern where page state, settings state, and runtime state all live in one oversized page component without clear boundaries.

## Backend Design

### Runtime Config Evolution

The current `/config` and `/configure` contract should evolve from:

- one workspace root
- three provider slots

to:

- one workspace root
- `providerProfiles[]`
- `modelProfiles[]`
- optional derived preset metadata

The backend should still return a normalized snapshot that the frontend can render without additional joins.

### Registry Persistence

This phase should support local persistence of provider/model registry state.

Acceptable first implementation:

- persist to a JSON file under the local app data area or repo-local `data/` storage

This is enough for a local-first product. A database migration is unnecessary unless the code becomes materially simpler with SQLite reuse.

### Agent Construction

The backend should continue using the current `deepagents` and `LangGraph` construction flow, but model initialization must move behind registry-aware resolver functions.

That means:

- built-in providers still map to provider-specific `init_chat_model` kwargs
- custom `openai-compatible` providers map to the OpenAI transport shape
- coordinator agents still derive from balanced/full-access permission modes

### Run Control Semantics

This phase should define concrete control semantics:

- `stop`: best-effort terminate active run and emit a terminal workbench status event
- `retry`: replay the last recoverable prompt in-thread
- `resume`: continue from an approval-gated pause
- `edit_plan`: submit revised execution instructions into a paused coordinator flow

The backend does not need to claim support for arbitrary rewind of internal graph state.

## Frontend Design

### Provider Settings Surface

Replace the fixed provider settings block with a registry editor.

Users should be able to:

- add provider
- edit provider
- enable/disable provider
- add model under provider
- choose default model
- see whether credentials are present

API secrets should remain write-only from the user’s perspective.

### Run Control Bar

Add a dedicated in-workbench control strip that shows:

- current run status
- active provider/model
- stop
- retry
- resume approval
- edit plan

Visibility should depend on `RunControlState.available_actions`, not on ad hoc error branches.

### Timeline And Status Language

The timeline should reuse the Phase A event protocol and standardize user-facing labels such as:

- `Reading files`
- `Searching workspace`
- `Writing code`
- `Waiting for approval`
- `Reviewing result`
- `Stopped`
- `Failed`

This is a product language problem, not just an event plumbing problem.

### Plan Editing Surface

Do not overload the normal chat input for plan editing.

Use a constrained surface attached to paused coordinator runs that lets the user revise execution instructions intentionally.

## Data Flow

1. User edits provider/model registry in settings.
2. Frontend posts normalized registry config to same-origin runtime config route.
3. Backend validates, persists, rebuilds runtime registry, and returns snapshot.
4. Derived preset catalog refreshes from the rebuilt registry.
5. User launches or resumes a thread with an explicit provider/model binding.
6. Runtime events update both timeline/artifact surfaces and `RunControlState`.
7. Workbench control bar renders actions from normalized run-control availability.
8. User control actions call same-origin endpoints that proxy backend stop/resume/edit-plan behavior.

## Testing Strategy

### Backend

- config normalization tests for provider/model registry payloads
- runtime registry tests for derived preset generation from custom providers
- route tests for `/config` and `/configure` registry snapshots
- run-control endpoint tests for stop/resume/edit-plan semantics where supported

### Frontend Unit

- runtime settings normalization for provider/model registry payloads
- run-control action visibility and fallback behavior
- provider settings UI state transitions
- timeline status label normalization

### Browser

- configure a custom `openai-compatible` provider and custom model, save, and observe launchable presets
- run a thread and verify run status surface updates live
- stop a run from the workbench and verify terminal status
- trigger approval/recoverable flows and verify resume/retry visibility

## Risks

- Provider abstraction can become over-generalized if protocols are not intentionally constrained.
- Plan editing can become misleading if the UI implies arbitrary graph rewrites that the backend cannot honor.
- Refactoring runtime config and settings UI in one phase can create regressions if preset fallback behavior is not preserved.
- The current large [web/src/app/page.tsx](D:/AgentBuild/.worktrees/deepagents-foundation/web/src/app/page.tsx) component increases integration risk unless the work is decomposed while implementing.

## Verification

- Focused backend:
  - `uv run --project agent pytest -v agent/tests/test_config_and_presets.py agent/tests/test_live_provider_activation.py agent/tests/test_v2_endpoints.py`
- Focused frontend:
  - `npm --prefix web run test -- src/lib/__tests__/runtime-settings.test.ts src/lib/__tests__/runtime-errors.test.ts src/app/api/runtime-config/route.test.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
