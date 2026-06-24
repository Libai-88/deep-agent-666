# deep-agent-666

Local-first single-assistant MVP built on Deep Agents, LangGraph, and CopilotKit.

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
cd web
npm install
npx playwright install chromium
cd ..
```

## Run

### Backend

```powershell
uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

### Frontend

```powershell
cd web
npm run dev
```

Open `http://127.0.0.1:3000`.

## Test

### Python

```powershell
uv run --project agent pytest
```

### TypeScript

```powershell
cd web
npm run test
```

### Browser smoke

```powershell
cd web
npm run e2e
```
