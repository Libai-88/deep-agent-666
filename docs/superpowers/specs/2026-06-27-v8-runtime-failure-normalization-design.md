# V8 Runtime Failure Normalization Design

> Status: Approved for implementation
> Date: 2026-06-27
> Scope: V8 `真实 provider 失败的 AG-UI 终止语义`

## Goal

Convert real upstream provider failures from abrupt stream crashes into protocol-valid AG-UI terminal events that the frontend can recover from deterministically.

## Root Cause

After V7, the product can classify several runtime failures in the frontend, but the direct Python AG-UI route still lets provider exceptions escape from the `StreamingResponse` generator.

Observed real behavior in the current environment:

- `openai-balanced` starts a run
- the upstream provider raises `PermissionDeniedError`
- the HTTP stream breaks instead of ending with a protocol-level terminal event

That violates AG-UI expectations:

- each run must begin with `RUN_STARTED`
- each run must terminate with `RUN_FINISHED` or `RUN_ERROR`

## In Scope

1. Catch exceptions inside the direct AG-UI route stream generator.
2. Close any open message/tool/reasoning frames before emitting `RUN_ERROR`.
3. Emit structured provider-facing error codes for common upstream failures.
4. Teach the frontend to recognize a new access-denied/region-denied provider failure class.

## Out Of Scope

- changing the LangGraph / Deep Agents internals
- SDK version upgrades
- broader UI redesign of the recovery notice system
- converting all possible RAW events into richer product activities

## Design Direction

### 1. Normalize at the route boundary

The direct AG-UI route is the narrowest safe place to normalize failures because:

- it already owns SSE encoding
- it can observe partially emitted events
- it can close open frames before emitting the terminal error

### 2. Prefer structured error codes over message parsing

The backend should emit stable `RUN_ERROR.code` values such as:

- `provider_rate_limited`
- `provider_auth_failed`
- `provider_access_denied`
- `provider_model_unavailable`

The frontend can still keep string-based heuristics as fallback, but the primary contract should be a structured code.

### 3. Keep client-facing messages generic

Do not stream raw provider exception payloads back to the browser. Log the full exception server-side and emit a bounded, product-safe message plus a structured code.

## Success Criteria

1. Real upstream failures no longer escape as unhandled streaming exceptions.
2. Direct AG-UI routes emit protocol-valid terminal `RUN_ERROR` events.
3. Open text/reasoning/tool frames are closed before `RUN_ERROR`.
4. Frontend recovery can distinguish provider access denial from generic runtime failure.

## Remaining Risk After V8

V8 fixes the direct Python AG-UI route boundary. It does not yet guarantee that every failure emitted from every deeper runtime path is already normalized into the richest possible user-facing UX. Further hardening can still improve retry, recovery, and activity-level diagnostics.
