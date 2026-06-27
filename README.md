# deep-agent-666

Local-first general-purpose workspace agent built on Deep Agents, LangGraph, and CopilotKit.

## Who This Is For

This repository is set up so a beginner can get from clone to running product with a small number of commands. There are two recommended paths:

- `npm run dev`: best for active development
- `npm run start`: best for a stable production-like local run
- `docker compose up --build`: best when you want the whole product booted in containers

## Windows setup

1. Copy `.env.example` to `.env`.
2. Fill in at least one provider key:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
3. Set `AGENT_WORKSPACE_ROOT` to the initial workspace the agent is allowed to inspect.

You can change the active workspace root later from the in-product `Settings` dialog without restarting the services.

## Install

### Backend

```powershell
uv sync --project agent --extra dev
```

### Frontend

```powershell
npm --prefix web install
npx --prefix web playwright install chromium
```

## Quick Start

### Development mode

```powershell
npm run dev
```

This starts:

- Next.js dev server on `http://127.0.0.1:3000`
- FastAPI agent on `http://127.0.0.1:8123`

### Stable production-like mode

```powershell
npm run start
```

This command builds the frontend first, then starts the web app and agent together in production mode.

### Docker mode

```powershell
docker compose up --build
```

This starts the same two-service topology (`web` + `agent`) using `.env`.

## Manual Run

### Backend

```powershell
uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

### Frontend

```powershell
npm --prefix web run dev
```

Open `http://127.0.0.1:3000`.

## Current limits

- `Phase A` 已统一 workbench runtime protocol：coordinator state snapshot、tool 结果和 A2UI artifact 现在会收口为共享的 `workbench event` 语义，timeline、results 和 final summary 统一消费这一层协议。
- `V27` 已激活 A2UI diff preview：`write_text_file` / `replace_text_in_file` 现在会返回结构化编辑结果，并在聊天流里内联渲染 `DiffPreview`。
- The CopilotKit runtime now uses a local SQLite thread store by default (`COPILOTKIT_THREADS_DB_PATH`, default `./data/threads.db`), and `Retry last task` now persists the last runnable prompt so a restored thread can replay it after refresh/reload.
- Restored threads that still have local workbench context but no runtime message history, or only a partial runtime history that is missing the latest local task, are now detected explicitly and routed into a recovery flow instead of silently looking healthy.
- Provider configuration now re-bootstraps the root runtime in the same session, so a beginner can save a key and launch the first guided task without a manual reload.
- OpenAI presets now align with the OpenAI default base URL and use `gpt-4.1-mini` instead of an OpenRouter-specific model id.
- Real upstream provider failures on the direct Python AG-UI route now terminate with protocol-valid `RUN_ERROR` events, including structured codes such as `provider_access_denied`.
- The web runtime now persists the last live preset catalog to `COPILOTKIT_RUNTIME_CATALOG_PATH` (default `./data/runtime-catalog.json`), so the main CopilotKit route can keep restoring persisted threads when `/presets` is temporarily unavailable.
- The coordinator starter flow now has a browser regression that proves planner/executor/reviewer cards, timeline tasks, and results summary appear together in one thread, and timeline statuses are rendered with beginner-friendly labels instead of raw internal values.
- Runtime settings now flow through the app-owned `/api/runtime-config` route, and beginners can inspect/change the active workspace root from `Settings` without editing `.env` or calling the backend directly from the browser.
- Settings now includes a custom provider registry editor for `openai-compatible` gateways and custom models, and the frontend now accepts dynamic presets emitted from that registry instead of filtering them down to built-in providers only.
- The workbench now exposes a control plane surface in-thread: `RunControlBar` stays visible during active work, timeline copy is normalized into user-facing language, and paused coordinator runs can open a constrained `Edit plan` panel before resuming.
- `npm run e2e` now also proves that completed threads survive both mocked continuity flows and real production web-process restarts. The suite covers first-run launch, workspace-root settings saves, coordinator workbench rendering, healthy restored-thread continuity, restored-thread retry recovery, full history-gap detection, partial history-drift detection, dedicated true process-restart proofs for both the main agent route and the coordinator route, browser-visible coordinator continuity after a real restart using real `next start`, SQLite persistence, and cached preset-catalog fallback, plus coordinator in-thread replay after a real restart swaps the runtime to an empty SQLite store. The Vitest suite also includes runtime-level proofs for both fresh-instance SQLite restore and route-level restore during preset-catalog outages.
- Local threads can now be renamed and deleted directly from the thread list, with deletion also cleaning persisted workbench state and automatically falling back to the next most recent thread or the starter gate.
- The shell now exposes runtime diagnostics in-product, with a status badge plus a diagnostics dialog that shows backend reachability, live-vs-fallback preset source, configured providers, and workspace-root context before a beginner has to guess what broke.
- Backend recovery actions now also re-bootstrap the CopilotKit runtime in the current tab, so a beginner can retry connection and launch the next guided task without manually reloading the page first.
- Recoverable runtime/backend failures no longer force active threads back into the onboarding gate; the current thread shell, timeline, and results stay visible while the user recovers in place.
- Active-thread recovery is now context-aware: when a stored last task exists, backend-unreachable notices can surface `Retry last task` directly in the same thread, so the user can reconnect and replay without retyping the prompt.
- Coordinator threads now have a dedicated recovery replay proof: after reconnecting from a history-gap state, the same thread can replay its last task and refresh coordinator cards, timeline, and results without a false `thread_history_unavailable` interruption.

## Test

### Python

```powershell
uv run --project agent pytest -v
```

### TypeScript

```powershell
npm --prefix web run test
```

### Browser smoke

```powershell
npm --prefix web run e2e
```

This now covers 26 browser proofs total: 22 main Playwright specs plus 4 real process-restart specs.

### Production build

```powershell
npm --prefix web run build
```

## V2 Release Hardening

V2 focuses on:

- production startup reliability
- CI running browser smoke against production startup
- Docker delivery for beginners and operators

See [docs/releases/v2-release-hardening.md](docs/releases/v2-release-hardening.md) for the phase notes.
