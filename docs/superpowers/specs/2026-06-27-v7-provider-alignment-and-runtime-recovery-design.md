# V7 Provider Alignment And Runtime Recovery Design

> Status: Approved for implementation
> Date: 2026-06-27
> Scope: V7 `provider 预设一致性与运行时可恢复提示`

## Goal

Close the beginner-facing gap where the product labels a preset as `OpenAI`, defaults the base URL to the OpenAI API, but actually points the backend preset model at `openrouter/free`.

At the same time, make common upstream runtime failures more actionable than a single generic "request failed" state.

## Root Cause

The current OpenAI preset family in `agent/app/presets.py` uses:

- `openai:openrouter/free`

while the settings dialog in `web/src/app/page.tsx` presents:

- provider label: `OpenAI`
- default base URL: `https://api.openai.com/v1`

This creates a semantic mismatch for the first real provider run:

1. beginner enters an OpenAI key
2. product implies the OpenAI default endpoint is correct
3. backend preset targets an OpenRouter-specific model id
4. runtime failure becomes confusing and hard to recover from

## In Scope

1. Align all OpenAI presets to an actual OpenAI model id.
2. Add regression coverage so OpenAI presets cannot silently drift back to OpenRouter-specific ids.
3. Classify common runtime failures into recoverable UI states:
   - rate limit / quota
   - model unavailable / model mismatch
   - auth failure

## Out Of Scope

- adding a dedicated OpenRouter provider
- full upstream error normalization inside AG-UI streams
- SDK version upgrades
- broader provider configuration UX redesign

## Design Direction

### 1. Provider truth must be literal

If a preset is labeled `OpenAI`, then:

- provider id must stay `openai`
- default base URL should remain the OpenAI API
- model id must be a valid OpenAI model id

For V7, use `gpt-4.1-mini` as the default OpenAI preset model.

### 2. Error handling should classify before presenting

The current frontend recoverable state model is too coarse. V7 adds a small classification layer that inspects runtime errors and maps them into user-facing recovery states before rendering notices.

This should stay as a pure utility so it can be tested without UI-heavy setup.

### 3. Keep recovery actions simple

Do not add a large recovery workflow in this phase. The useful actions are still:

- reopen settings
- retry the last task

The improvement is correctness of diagnosis, not expansion of flows.

## Success Criteria

1. OpenAI presets no longer contain `openrouter/` model ids.
2. Backend and frontend tests fail if that mismatch comes back.
3. Runtime quota/model/auth failures map to distinct recoverable states.
4. Existing onboarding, runtime, and backend regression suites stay green.

## Remaining Risk After V7

V7 improves diagnosis and preset correctness, but it does not yet guarantee that every upstream provider error is emitted as a fully structured AG-UI stream lifecycle. That deeper normalization remains a later runtime-hardening task.
