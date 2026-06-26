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
3. Set `AGENT_WORKSPACE_ROOT` to the workspace the agent is allowed to inspect.

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

- The CopilotKit runtime now uses a local SQLite thread store by default (`COPILOTKIT_THREADS_DB_PATH`, default `./data/threads.db`), and `Retry last task` now persists the last runnable prompt so a restored thread can replay it after refresh/reload.
- Restored threads that still have local workbench context but no runtime message history, or only a partial runtime history that is missing the latest local task, are now detected explicitly and routed into a recovery flow instead of silently looking healthy.
- Provider configuration now re-bootstraps the root runtime in the same session, so a beginner can save a key and launch the first guided task without a manual reload.
- OpenAI presets now align with the OpenAI default base URL and use `gpt-4.1-mini` instead of an OpenRouter-specific model id.
- Real upstream provider failures on the direct Python AG-UI route now terminate with protocol-valid `RUN_ERROR` events, including structured codes such as `provider_access_denied`.
- `npm run e2e` now covers first-run launch, restored-thread retry recovery, full history-gap detection, and partial history-drift detection with deterministic AG-UI stream fixtures. The main remaining runtime hardening task is broader real-backend restart/resume validation across all runtime entrances.

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
