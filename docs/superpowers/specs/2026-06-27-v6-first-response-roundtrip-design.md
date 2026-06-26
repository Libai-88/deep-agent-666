# V6 First Response Roundtrip Design

> Status: Approved for implementation
> Date: 2026-06-27
> Scope: V6 `首次配置后的首条响应闭环`

## Goal

Prove and preserve the beginner-critical path:

`首次打开 -> 未配置 -> 保存 provider key -> 同页进入 starter -> 启动首条任务 -> 收到 assistant 首条响应`

V5 made backend agent activation live, but that alone does not guarantee the first-run session is actually usable without a full page reload.

## Why This Phase Exists

The current product still has a same-session gap:

1. the app opens in an unconfigured state
2. the root `Providers` component decides not to mount `CopilotKit`
3. the user opens settings and saves a provider key successfully
4. the page state can leave the unconfigured gate
5. but the root `Providers` component does not currently re-bootstrap the runtime in the same tab

That means the most important beginner path can still fail in the exact moment when the product claims it is ready.

## Current Technical Root Cause

`web/src/app/providers.tsx` currently performs a one-time bootstrap:

- it fetches `/api/preset-state`
- it may fetch `/api/copilotkit/info`
- it decides once whether to mount `<CopilotKit>`

When the app starts unconfigured, `copilotReady` becomes `false`, and nothing in the current flow tells `Providers` to re-check after a successful `/configure`.

`web/src/app/page.tsx` already reloads page-local catalog state on save, but that does not re-run the root provider bootstrap.

So there are two separate truths in the same session:

- the page knows presets are now available
- the root runtime provider still behaves as if the app is unconfigured

## In Scope

V6 introduces three changes:

1. `Same-session CopilotKit re-bootstrap`
   - the root provider must re-check runtime availability after a successful configuration save

2. `Deterministic browser-level roundtrip proof`
   - add a Playwright path that covers:
     - unconfigured gate
     - settings save
     - runtime bootstrap
     - starter launch
     - assistant response rendering

3. `Regression-proof event fixture`
   - the browser test should use a deterministic AG-UI text-message stream fixture rather than a live external model

## Out Of Scope

This phase does not include:

- external provider reliability
- real paid model invocation in CI
- SDK version upgrades
- deeper resume-after-restart validation
- desktop packaging

## Product Success Criteria

V6 is successful when all of the following are true:

1. Saving a provider key in the same browser session causes `CopilotKit` to become active without manual reload.
2. A starter task can be launched immediately after configuration in that same session.
3. The browser renders an assistant response for that first launch path.
4. The regression test is deterministic and does not depend on external model availability.

## Architecture Direction

### 1. Add an explicit runtime refresh signal

The simplest stable contract is:

- `SettingsDialog` dispatches a browser event after a successful save
- `Providers` listens for that event and re-runs its bootstrap logic

This keeps the fix local and avoids hoisting root runtime state through unrelated component layers.

### 2. Keep runtime bootstrap logic centralized

The logic for:

- reading preset availability
- resolving active thread / agent bootstrap state
- deciding whether `CopilotKit` should mount

should remain centralized inside `Providers`.

The phase should not duplicate that logic into page-level state.

### 3. Add a deterministic AG-UI text stream fixture for Playwright

The E2E proof should stub:

- `/api/preset-state`
- `/api/copilotkit/info`
- the runtime run endpoint for the selected agent

The run endpoint fixture should emit the minimum valid text-response lifecycle:

- `RUN_STARTED`
- `TEXT_MESSAGE_START`
- one or more `TEXT_MESSAGE_CONTENT`
- `TEXT_MESSAGE_END`
- `RUN_FINISHED`

This proves the actual browser path can consume and render a first assistant response without depending on a live provider.

## File-Level Direction

### Root runtime provider

- `web/src/app/providers.tsx`
  - re-bootstrap on a custom runtime-refresh event
  - keep bootstrap state and readiness logic in one place

### Settings save flow

- `web/src/app/page.tsx`
  - after successful save, trigger the provider refresh signal

### E2E coverage

- `web/tests/e2e/`
  - add a first-run roundtrip spec
  - add small helper(s) for deterministic AG-UI SSE responses if needed

## Testing Strategy

### Browser regression

One Playwright test should prove:

1. app starts at `Configure your providers`
2. user opens settings
3. user enters a provider key and saves
4. app transitions to starter templates
5. user starts a guided task
6. first assistant message becomes visible

### Existing regression suite

The phase must keep current smoke tests green:

- unconfigured gate
- configured shell render
- runtime info reachability
- direct agent run stream

## Risks And Tradeoffs

### Risk: event-driven refresh creates hidden coupling

Mitigation:

- use one explicit, product-named browser event
- document it as the runtime bootstrap refresh contract

### Risk: browser test becomes a UI-only mock

Mitigation:

- stub only the minimum boundaries required for deterministic execution
- still drive the real page, settings flow, starter launch, CopilotKit message rendering, and AG-UI event consumption

### Risk: future runtime changes break the fixture silently

Mitigation:

- keep the fixture aligned to documented AG-UI event types
- assert on visible assistant output, not only network status

## Exit Criteria

This phase is complete when:

1. same-session post-configure runtime bootstrap works
2. Playwright proves `configure -> launch -> first response`
3. documentation records V6 as the first-response roundtrip phase
