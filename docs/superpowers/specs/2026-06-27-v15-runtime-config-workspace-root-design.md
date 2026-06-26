# V15 Runtime Config Workspace Root Design

## Goal

Make the product behave more like a general-purpose Codex-style workspace agent for beginners by allowing the active workspace root to be viewed and changed from the product itself, without editing `.env` or restarting services manually.

## Why This Matters

The current product still assumes the operator sets `AGENT_WORKSPACE_ROOT` out-of-band. That is workable for engineering users, but it is not a beginner-friendly product surface:

- the user cannot see which folder the agent is actually operating on
- the user cannot switch to a different local project from inside the app
- the chat context currently reports a hard-coded fallback workspace root on the client
- the settings form writes directly to `http://127.0.0.1:8123/configure`, which is less stable than the app's existing same-origin proxy pattern

This is a product gap, not just a technical debt item.

## Official-Pattern Alignment

CopilotKit's examples and runtime guidance consistently centralize agent/runtime access behind app-owned routes and provider wiring instead of scattering raw backend calls through the UI. Our repository already follows that direction for `/api/copilotkit` and `/api/preset-state`; V15 extends the same product boundary to runtime configuration.

## Scope

V15 covers four concrete improvements:

1. The Python backend exposes a read-safe runtime config snapshot and accepts workspace-root changes at runtime.
2. The Next.js app exposes a same-origin `/api/runtime-config` proxy for reading and writing runtime configuration.
3. The settings dialog can load the current workspace root, edit it, save it, and keep the UI state aligned with the backend snapshot.
4. The active workspace root becomes visible to the product and is passed to the agent context instead of a hard-coded fallback value.

## Non-Goals

- No native folder picker integration in the browser.
- No persistence back to `.env`; runtime mutation remains process-local, matching the existing provider-key behavior.
- No multi-workspace registry or recent-workspace history yet.
- No changes to the thread store format.

## Backend Design

### New Runtime Config Snapshot

Add `GET /config` on the FastAPI service. It returns:

- `workspaceRoot`
- per-provider `configured` booleans
- per-provider current `baseUrl` values

It must not return raw API keys.

### Workspace Root Mutation

Extend `POST /configure` to accept an optional `agent_workspace_root` string. When present:

- normalize it to an absolute path
- reject it if the path does not exist
- reject it if the path is not a directory
- update the runtime `ConfigStore`
- rebuild the live runtime registry so agent tools point at the new root

Rejected workspace roots should return a 400 response with a machine-readable code so the web app can show a beginner-readable message.

### Runtime Safety

Changing the workspace root must update:

- route-level workspace browsing endpoints
- runtime-generated LangGraph agents
- coordinator toolsets

The existing `store.snapshot().workspace_root` and `_reload_agents()` pattern already gives us the right hot-reload boundary; V15 only makes it reachable from the product surface.

## Web Design

### Same-Origin Runtime Config Route

Add `GET/POST /api/runtime-config` in Next.js. It proxies to the backend base URL and becomes the only UI-facing runtime-config endpoint.

This mirrors the product's existing route ownership pattern:

- `/api/copilotkit` for runtime transport
- `/api/preset-state` for preset catalog reads
- `/api/runtime-config` for runtime configuration reads/writes

### Runtime Settings State

Introduce a small normalization layer for runtime config payloads so the UI can safely consume:

- `workspaceRoot`
- provider `configured` flags
- provider `baseUrl` values

The UI should tolerate either camelCase or snake_case payloads to keep the boundary resilient.

### Settings Dialog Behavior

When the settings dialog opens:

- load the current runtime config
- prefill the workspace root field
- prefill any base URLs already known by the backend

When the user saves:

- send provider keys, base URLs, and `agent_workspace_root` through `/api/runtime-config`
- refresh the runtime bootstrap
- refresh local catalog state
- store the latest `workspaceRoot` in page state

If the backend rejects the workspace path, the dialog should show a specific error and the page should use a dedicated recoverable error code instead of collapsing everything into generic configuration failure.

### Product Visibility

The active workspace root should be visible in the main header as a compact label and should be sent into `useAgentContext` as the real runtime workspace root.

This gives beginners a simple answer to “which folder is the agent looking at right now?”

## Error Handling

Add a dedicated web-facing recoverable error for invalid workspace roots. Its copy should make the failure obvious:

- the chosen folder was not found or is not a directory
- reopen settings and choose a valid local folder

Generic backend/network failures should keep the existing `backend_unreachable` and `configuration_failed` flows.

## Testing Strategy

### Backend

- prove `POST /configure` accepts a valid workspace-root change
- prove `GET /config` reflects the updated snapshot
- prove an invalid workspace root returns `400` and does not mutate the live snapshot

### Web Route

- prove `GET /api/runtime-config` proxies and normalizes the backend response
- prove `POST /api/runtime-config` forwards the workspace-root field and preserves backend error codes

### Frontend

- prove runtime config normalization handles camelCase and snake_case payloads
- prove the settings flow renders and submits the workspace root through the same-origin route

### Full Verification

- `npm --prefix web run typecheck`
- `npm --prefix web run test`
- `npm --prefix web run build`
- `npm --prefix web run e2e`
- `uv run --project agent pytest -v`

## Risks And Tradeoffs

- Runtime mutation is still process-local. That is acceptable for now because the product already treats provider configuration the same way.
- The browser still cannot open a native directory picker without a broader desktop/runtime decision. Text-path entry is enough for V15.
- The page component is already large. V15 should avoid unrelated refactors and keep new logic in focused helpers/routes where practical.
