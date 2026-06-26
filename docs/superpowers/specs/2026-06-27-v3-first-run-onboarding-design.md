# V3 First-Run Onboarding Design

> Status: Approved for planning
> Date: 2026-06-27
> Scope: V3-B `首用路径优先`

## Goal

Turn the current mixed-scenario workspace agent into a product that a new user can successfully use on the first launch without guessing the next step.

The V3 success path is:

`首次打开 -> 完成最少配置 -> 发起第一个任务 -> 看懂执行过程 -> 拿到结果 -> 知道下一步怎么继续`

This phase improves first-run usability and recoverability. It does not replace the current workbench architecture.

## Why This Phase Exists

V1 and V2 established the product foundation:

- V1 completed the mixed-scenario workbench and coordinator runtime.
- V2 hardened release startup, CI, and deployment basics.

The main remaining product gap is not missing core capability. It is that the first-run experience is weak for a beginner:

- the home page drops the user directly into a full workbench
- the current empty state is generic and low-guidance
- provider setup is available, but only through a modal and short status text
- runtime failures are mostly surfaced as terse messages or console errors
- starter suggestions exist, but they do not form a guided first task path

The result is a product that is already capable, but still asks a new user to infer how to begin.

## Official Reference Patterns

This phase intentionally reuses proven patterns already present in the official CopilotKit repository at `D:\AgentBuild\copilotkit-repo`.

Relevant references:

- `showcase/integrations/langgraph-fastapi/src/app/demos/headless-complete/chat/empty-state.tsx`
  - centered first-paint empty state with clickable sample prompts
- `showcase/integrations/langgraph-fastapi/src/app/demos/headless-complete/chat/suggestion-bar.tsx`
  - explicit suggestion surface that hides while the agent is running
- `examples/integrations/langgraph-fastapi/src/hooks/use-example-suggestions.tsx`
  - suggestion configuration as a first-class entry path
- `showcase/integrations/langgraph-fastapi/src/app/demos/agent-config/page.tsx`
  - typed frontend configuration carried into runtime context

V3 does not copy these demos wholesale. It absorbs the interaction patterns that are most relevant to first-run onboarding.

## In Scope

V3 introduces four new product capabilities:

1. `First-Run Gate`
   - detect whether the user can actually start
   - route the user into configuration, recovery, or first-task entry

2. `Starter Task Templates`
   - replace generic first-run prompting with guided engineering, research, and general templates
   - let a new user begin with one click instead of inventing a prompt

3. `Readable Empty States`
   - give every pre-task and post-failure state a clear explanation and action

4. `Recovery Hooks`
   - map common failures to concrete user actions instead of passive error text

## Out of Scope

This phase must stay focused enough to support one implementation plan and one development cycle.

Explicitly out of scope:

- multi-workspace switching
- backend architecture replacement
- new mandatory services
- account/login system
- cloud sync
- desktop shell redesign
- advanced prompt library management
- broad visual redesign of the entire product

## User Experience Success Criteria

V3 is successful when these outcomes are true:

1. A first-time user can discover the next step without reading external docs.
2. A user with no configured provider sees a guided configuration path rather than a dead-end message.
3. A user with a valid environment but no thread is offered starter tasks before seeing an empty chat shell.
4. A starter task creates a thread and moves the user directly into the existing workbench.
5. Common recoverable failures present a recommended action.
6. Existing advanced users can still use the current workbench without losing capability.

## Current Product Baseline

The existing frontend already has strong V1/V2 foundations:

- persistent thread list
- timeline panel
- artifact/results panel
- CopilotChat-based main workspace
- settings dialog for provider keys and base URLs
- workbench state persistence

Current weak points in `web/src/app/page.tsx` and `web/src/app/providers.tsx`:

- first-load path is implicit rather than guided
- the no-preset state is only one sentence
- suggestions are static and broad
- settings feedback is shallow
- provider/runtime errors are not normalized into actionable UI states

V3 should layer on top of this baseline, not replace it.

## Product Architecture

The home screen becomes a two-layer product:

### 1. Entry Layer

This is a thin first-run decision layer shown before or above the main workbench when the user is not yet on a healthy first-task path.

Its job is to answer:

- can the product start?
- if not, what exactly is missing?
- if yes, what should the user do first?

It has three surfaces:

- `FirstRunGate`
- `StarterTemplatePanel`
- `WorkbenchStatusNotice`

### 2. Workbench Layer

This remains the existing four-part layout:

- threads
- timeline
- chat
- results

The workbench stays the core operating surface after entry conditions are satisfied.

## Entry States

The onboarding logic is formalized as a small frontend state model.

```ts
type FirstRunState =
  | "checking"
  | "unconfigured"
  | "ready-no-thread"
  | "ready-active-thread"
  | "recoverable-error";
```

### `checking`

Initial load state while the frontend determines:

- whether backend connectivity exists
- whether at least one preset is available
- whether a valid local thread already exists

### `unconfigured`

Used when no launchable preset is available.

Primary action:

- configure provider credentials

### `ready-no-thread`

Used when the environment is usable but the user has not started the first task.

Primary action:

- select a starter template

### `ready-active-thread`

Used when a valid thread exists and the user can continue normal work.

Primary action:

- show the workbench directly

### `recoverable-error`

Used when the environment is partially broken, but the user can take a corrective action without developer intervention.

Primary action:

- show the recovery action that matches the detected failure

## New UI Units

### `FirstRunGate`

Purpose:

- replace the current dead-end no-preset view with a guided start surface

Responsibilities:

- show why the user cannot proceed
- show the recommended first action
- open the existing settings workflow when configuration is required
- surface retry actions for connectivity checks

Key rule:

- this component does not manage runtime logic directly; it only renders state derived elsewhere

### `StarterTemplatePanel`

Purpose:

- turn first-run prompting into guided task selection

Responsibilities:

- present a small curated template list
- split templates into `engineering`, `research`, and `general`
- on selection, create a thread if needed and send the user into the workbench path

Key rule:

- this is not a full prompt library; it is a compact onboarding surface

### `WorkbenchStatusNotice`

Purpose:

- surface recoverable runtime problems inside the workbench without hiding the workspace

Responsibilities:

- show contextual notices such as backend unavailable, failed configuration, invalid thread, or no recent results
- provide action buttons aligned with the detected problem

Key rule:

- this notice complements the workbench; it does not replace the workbench once the user is already active

## Starter Template Strategy

Starter templates are not generic demo prompts. They are onboarding tools designed to make the product legible.

The initial template catalog should stay small:

### Engineering

- `Analyze this repository structure and summarize the major modules`
- `Find risky files or TODOs and propose the next engineering tasks`

### Research

- `Read the workspace docs and summarize the current project direction`
- `Compare the current implementation against official CopilotKit examples`

### General

- `Explain what this workspace is and how the agent can help me here`
- `Inspect the current thread and show the next recommended step`

Rules:

- each template must be safe to run in the current single-workspace model
- each template must produce understandable timeline and artifact output
- each template must teach the user something about the product’s capabilities

## Thread Creation And First Task Flow

When a user clicks a starter template, the frontend should perform one bounded flow:

1. resolve a valid preset or keep the current active preset
2. create a new thread if there is no usable active thread
3. attach the selected task category to the thread workbench state
4. inject the template prompt as the first user task
5. route the UI into the existing workbench
6. let the timeline and artifact panels explain what is happening

This preserves one unified product model:

- one thread model
- one workbench state model
- one mixed-scenario agent product

It does not split onboarding into a separate application.

## Error And Recovery Model

Errors in this phase must resolve to clear user actions.

Recommended normalized error types:

```ts
type RecoverableErrorCode =
  | "backend_unreachable"
  | "no_available_presets"
  | "configuration_failed"
  | "thread_missing_or_invalid"
  | "runtime_request_failed";
```

Recommended action mapping:

- `backend_unreachable`
  - `Retry connection`
  - `Open settings`

- `no_available_presets`
  - `Configure provider`

- `configuration_failed`
  - `Retry save`
  - `Check base URL`

- `thread_missing_or_invalid`
  - `Create recommended thread`

- `runtime_request_failed`
  - `Retry last task`

Design rules:

- every recoverable state must explain the problem in plain language
- every recoverable state must present at least one direct action
- console-only error visibility is not acceptable for first-run flows

## Data And Control Flow

The new onboarding logic should remain frontend-local.

### Data Inputs

- runtime preset availability
- backend connectivity checks
- local thread registry
- local workbench state
- settings save result

### Data Outputs

- first-run state
- selected starter template metadata
- thread creation intent
- mapped recovery action

### Control Principle

The onboarding layer reads existing product state and routes the user to the next correct surface. It does not introduce a new persistence backend or a second runtime stack.

## File-Level Design Direction

Planned impact area:

- `web/src/app/page.tsx`
  - host the first-run state routing and top-level entry/workbench switching

- `web/src/app/providers.tsx`
  - stop relying on raw console errors as the only global runtime signal

- `web/src/lib/`
  - add a small state resolver for onboarding and a typed recovery mapping utility

- `web/src/components/`
  - add `FirstRunGate`
  - add `StarterTemplatePanel`
  - add `WorkbenchStatusNotice`

This phase should not require backend file changes unless later implementation proves a specific runtime check is impossible from current frontend inputs.

## Testing Strategy

Testing must prove the onboarding path, not just page rendering.

### Unit Tests

- first-run state resolution for each launch condition
- starter template to thread/task conversion
- error-code to action mapping

### Component Tests

- `FirstRunGate` in `unconfigured`
- `StarterTemplatePanel` in `ready-no-thread`
- `WorkbenchStatusNotice` in recoverable error states

### End-To-End Tests

- unconfigured launch shows onboarding gate
- configured launch without a thread shows starter templates
- clicking a starter template creates a thread and opens the workbench
- backend unavailable state surfaces a recovery action instead of silent failure

## Backward Compatibility

V3 must preserve:

- existing thread persistence
- existing workbench layout
- existing coordinator and preset model
- current mixed engineering/research positioning

The change is additive:

- advanced users still reach the familiar workbench
- new users gain an explicit first-run path

## Risks And Tradeoffs

### Risk: Too Much Onboarding Surface

If the entry layer becomes too large, it delays access to the real product.

Mitigation:

- keep onboarding thin
- route quickly into the existing workbench after one successful action

### Risk: Prompt Template Drift

If starter templates become broad or stale, they stop helping beginners.

Mitigation:

- keep the list short
- tie templates directly to current product capabilities

### Risk: Duplicate State Logic

If onboarding checks are scattered across components, the system becomes hard to reason about.

Mitigation:

- centralize first-run state resolution and recovery mapping in typed utilities

## Phase Exit Criteria

This design is implemented successfully when:

1. first launch no longer presents a dead-end no-preset screen
2. a configured user with no thread sees onboarding templates before an empty chat shell
3. one template click reliably creates a usable first task path
4. common recoverable failures map to explicit UI actions
5. the existing workbench remains the main operating surface after onboarding

## Implementation Boundary

This spec is intentionally scoped to a single V3 onboarding phase.

It is ready for one implementation plan because:

- the feature set is bounded
- the affected files are concentrated in the frontend shell
- the state model is small
- the success criteria are testable

No placeholder decisions remain open in this phase.
