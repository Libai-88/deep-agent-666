# V12 Runtime Persistence Proof Design

## Problem

V11 made thread-history loss and drift visible at the product layer, but we still lacked a repo-local proof that the real CopilotKit runtime stack could recreate a thread from the shared SQLite store after the runtime itself was rebuilt.

## Goal

Prove runtime-level thread restoration through the actual `CopilotRuntime` fetch handler, not only through isolated runner tests or product-level warning flows.

## Constraints

- Stay on the production runtime assembly path.
- Avoid real model/provider dependencies.
- Keep the proof deterministic and fast enough for the normal Vitest suite.

## Design

1. Build a runtime from the real catalog/runtime factory using a temp SQLite file.
2. Stub the remote backend surface with a deterministic AG-UI SSE byte stream.
3. Send a real `/agent/openai-balanced/run` request through `createCopilotRuntimeHandler(...)`.
4. Create a second runtime instance pointed at the same SQLite file.
5. Send a real `/agent/openai-balanced/connect` request through the fresh runtime instance.
6. Assert the restored payload still contains:
   - the original user prompt
   - the assistant reply from the first run
   - no second backend call during restore

## Expected Outcome

- The repository now has direct evidence that finished threads survive runtime recreation.
- The remaining hardening work is reduced to broader multi-entry and true process-restart coverage, not basic runtime persistence doubt.
