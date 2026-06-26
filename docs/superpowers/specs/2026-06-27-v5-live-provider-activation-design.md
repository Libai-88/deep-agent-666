# V5 Live Provider Activation Design

> Status: Approved for implementation
> Date: 2026-06-27
> Scope: V5 `首次配置后即时可启动`

## Goal

Make provider configuration truly live so a beginner can add an API key, close settings, and immediately launch a first task without restarting the backend or hitting missing-agent routes.

The V5 success path is:

`首次打开 -> 未配置 -> 保存 provider key -> 预设立即可见 -> 第一个线程立即可运行`

This phase closes a product-breaking gap left behind by V3 onboarding: the UI can currently tell a user they are configured even when the backend has not actually mounted the corresponding runtime endpoints.

## Why This Phase Exists

The product already has:

- first-run guidance
- starter templates
- local runtime durability

But there is still a hidden failure mode:

1. the user starts unconfigured
2. the user opens settings and saves an API key
3. `/presets` updates and the UI may leave the unconfigured state
4. the backend's direct AG-UI routes remain whatever was mounted at process startup
5. the first real task can fail because the configured agent path is not actually live yet

For a beginner-focused Codex-like agent, this is unacceptable. The first success path must not require a hidden backend restart.

## Current Technical Root Cause

The backend currently mixes two registration models:

- `CopilotKitRemoteEndpoint`
  - can already serve a dynamic agent list because `agents=` supports a callable
- `add_langgraph_fastapi_endpoint`
  - currently registers one static FastAPI route per agent at import/startup time

Current code in `agent/app/main.py`:

- builds `v1_agents` and `coordinator_agents` once at startup
- mounts `/{preset_id}` and `/coordinator-{preset_id}` once
- `/configure` only updates config store and `presets_by_id`
- `_reload_agents()` does **not** remount direct agent endpoints

This creates a split brain:

- the catalog can change
- the actual executable agent routes do not

## In Scope

V5 introduces four changes:

1. `Live backend agent registry`
   - keep a runtime registry of currently configured V1 and coordinator agents

2. `Dynamic direct AG-UI dispatch`
   - replace startup-only per-agent route mounting with request-time lookup against the live registry

3. `Live SDK agent list`
   - wire `CopilotKitRemoteEndpoint(agents=...)` to the same runtime registry so `/copilotkit` and direct routes stay consistent

4. `First-run reliability proof`
   - tests prove `/configure` changes both the advertised preset catalog and the executable agent surface

## Out Of Scope

This phase does not include:

- cloud/provider account management
- auth and rate limiting
- SDK version upgrades
- deeper thread resume and transcript persistence
- desktop packaging

## Product Success Criteria

V5 is successful when all of the following are true:

1. Saving a provider key via `/configure` makes the corresponding preset runnable without backend restart.
2. The backend agent registry used by `/copilotkit` and direct AG-UI execution is the same source of truth.
3. New coordinator routes for balanced/full-access presets become available immediately after configuration.
4. Health and preset surfaces stay consistent with the live registry.
5. First-run onboarding can rely on “configured” meaning “actually launchable”.

## Architecture Direction

The clean fix is not “re-register FastAPI routes on the fly”. That is brittle and framework-dependent.

The robust fix is:

### 1. Introduce a live registry

A runtime data structure should own:

- configured presets
- V1 `LangGraphAGUIAgent` instances
- coordinator `LangGraphAGUIAgent` instances
- combined agent lookup by route name

### 2. Use dynamic route dispatch

Expose stable route patterns:

- `POST /{agent_name}`
- `GET /{agent_name}/health`

Where `agent_name` includes both:

- preset ids such as `openai-balanced`
- coordinator ids such as `coordinator-openai-balanced`

The handler resolves the current agent instance from the live registry at request time.

### 3. Make SDK registration callable

`CopilotKitRemoteEndpoint(agents=...)` should read from the same registry dynamically so `/copilotkit/info` and `/copilotkit/agent/...` see the same current agent set.

## File-Level Design Direction

### New backend support file

- `agent/app/runtime_registry.py`
  - owns the current live configured agent state
  - exposes read/update helpers

### Main backend entry

- `agent/app/main.py`
  - initialize registry at startup
  - use dynamic SDK agent callable
  - replace static per-agent route assumptions with registry-backed handlers
  - update `/configure` to rebuild the live registry

### Tests

- `agent/tests/test_live_provider_activation.py`
  - proves `/configure` activates new presets and executable agent routes

Existing backend registration tests should also be updated to reference the live registry rather than startup-only globals.

## Testing Strategy

Testing must prove behavior, not just internal data shape.

### Unit/integration tests

- startup with one provider only exposes that provider’s routes
- configuring a second provider updates:
  - preset list
  - SDK agent list
  - direct executable route availability
- coordinator routes remain limited to balanced/full-access presets

### End-to-end follow-up

After backend live activation is implemented, the frontend E2E suite can safely add:

- configure provider -> starter launch -> first response

This follow-up is part of the same product direction, but the phase’s minimum shippable boundary is the live backend activation contract.

## Risks And Tradeoffs

### Risk: generic catch-all route collides with non-agent paths

Mitigation:

- keep workspace endpoints explicit and registered separately
- constrain dynamic agent route handling to known current registry names

### Risk: route handlers become harder to reason about

Mitigation:

- isolate registry logic in a dedicated backend file
- keep request-time dispatch tiny and deterministic

### Risk: registry rebuilds create stale references

Mitigation:

- rebuild the registry atomically and swap the whole current structure
- avoid mutating old agent maps in place

## Exit Criteria

This phase is complete when:

1. `/configure` immediately activates newly configured presets for execution
2. backend tests prove live activation without restart
3. first-run configuration no longer lies about launchability
4. docs record live provider activation as the current behavior

