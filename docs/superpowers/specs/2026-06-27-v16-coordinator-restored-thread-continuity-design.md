# V16 Coordinator Restored Thread Continuity Design

## Goal

Prove, at the browser level, that a completed coordinator thread remains understandable and usable after a page reload, with restored chat history and persisted workbench surfaces staying aligned.

## Why This Matters

The product already has strong lower-level coverage for runtime persistence:

- SQLite-backed runtime persistence
- route-level restoration during preset-catalog outages
- user recovery when runtime history is missing or drifted

What is still missing is a user-facing continuity proof for the main coordinator path after reload. Today we have:

- V14: starter-launched coordinator run in one continuous session
- V10/V11: browser proofs for missing/drifted history recovery
- V12/V13: runtime/route persistence proofs below the browser surface

We do not yet prove the “healthy restore” case for a coordinator thread that should reopen cleanly.

For beginners, that is a core trust question: after they refresh, do they still see their plan, results, and restored chat, or does the product feel reset or inconsistent?

## Scope

V16 adds one focused browser regression for the healthy restored-thread path:

1. Launch a coordinator starter task.
2. Let the workbench complete with planner/executor/reviewer output.
3. Reload the page while preserving local thread/workbench state.
4. Mock a healthy `connect` restore that includes the original latest prompt and assistant response.
5. Assert the product restores without recovery warnings and keeps the workbench readable.

## Non-Goals

- No real multi-process restart orchestration in Playwright.
- No new persistence format changes.
- No attempt to restore historical tool-call cards in the chat transcript if the runtime does not replay tool-call frames on connect.
- No changes to backend persistence semantics.

## Approach Options

### Option A: Seed localStorage and restored history directly

Pros:

- Fast to write
- Deterministic
- Similar to V10/V11

Cons:

- Less representative of the actual first-run -> completed-thread -> reload lifecycle
- Does not prove the product persisted the first-session workbench state correctly

### Option B: Full browser lifecycle with run, then reload

Pros:

- Closest to the real beginner journey
- Proves that the first session wrote durable local state
- Proves that reload + healthy runtime restore does not trigger false recovery UI

Cons:

- Slightly more test setup

### Recommendation

Choose Option B.

The product gap is about continuity, not just deserialization. A full lifecycle regression gives higher confidence with modest extra complexity.

## Test Design

### Phase 1: First Session

Mock:

- `/api/preset-state` with a live `openai-balanced` preset
- `/api/copilotkit/info` with `coordinator-openai-balanced`
- `/api/copilotkit/agent/**/connect` as an empty initial connection
- `/api/copilotkit/agent/**/run` with the existing deterministic coordinator stream

Drive:

- open `/`
- click the engineering starter
- wait for final summary and completed timeline

### Phase 2: Reloaded Session

Switch the `connect` mock so reload returns a healthy restored history stream that includes:

- the original latest user prompt
- a restored assistant reply

Reload the page and assert:

- no `Thread history unavailable` notice appears
- the restored assistant message is visible
- timeline panel still shows completed coordinator todos
- results panel still shows the final summary
- starter gate does not reappear

## Product Expectations

If a coordinator thread has both:

- valid local workbench context
- runtime-restored history containing the latest local prompt

then the page should treat it as healthy, not as a recovery case.

That means the UI must preserve:

- persisted workbench state from local storage
- restored runtime chat messages
- absence of spurious recovery banners

## Risks

- Connect-stream mocking must include the latest prompt; otherwise the product will correctly classify the thread as history drift.
- The chat transcript may not restore the inline tool cards, depending on runtime replay shape. V16 should not assert those cards after reload.
- This is a browser-level continuity proof, not a replacement for future real process-restart orchestration.

## Verification

- Focused: `npm --prefix web run e2e -- coordinator-restored-thread-continuity.spec.ts`
- Full:
  - `npm --prefix web run typecheck`
  - `npm --prefix web run test`
  - `npm --prefix web run build`
  - `npm --prefix web run e2e`
  - `uv run --project agent pytest -v`
