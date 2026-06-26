from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ag_ui.core.types import RunAgentInput
from ag_ui.encoder import EventEncoder
from copilotkit import CopilotKitRemoteEndpoint
from copilotkit.integrations.fastapi import add_fastapi_endpoint

from app.config import ConfigStore, load_settings
from app.presets import DEFAULT_PRESET_ID
from app.runtime_registry import (
    LiveAgentAccessor,
    RuntimeAgentRegistry,
    build_runtime_registry,
)
from app.tools.workspace import resolve_workspace_path


settings = load_settings()
store = ConfigStore(settings)
app = FastAPI(title="deep-agent-666-agent")

# CORS: allow browser-side @ag-ui/client HttpAgent to connect directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConfigureRequest(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    google_api_key: str | None = None
    google_base_url: str | None = None


runtime_registry: RuntimeAgentRegistry = build_runtime_registry(settings)


def _current_registry() -> RuntimeAgentRegistry:
    return runtime_registry


sdk = CopilotKitRemoteEndpoint(agents=LiveAgentAccessor(_current_registry))
add_fastapi_endpoint(app, sdk, "/copilotkit")


def _reload_agents() -> None:
    """Rebuild the live runtime registry after /configure."""
    global runtime_registry
    runtime_registry = build_runtime_registry(store.snapshot())


def _resolve_route_agent(agent_name: str):
    agent = _current_registry().route_agents.get(agent_name)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return agent


@app.get("/health")
async def health() -> JSONResponse:
    agents = _current_registry().all_agents
    return JSONResponse({"status": "ok", "preset_count": len(agents), "agents": [a.name for a in agents]})


@app.get("/presets")
async def presets() -> JSONResponse:
    presets_by_id = _current_registry().presets_by_id
    default_preset_id = (
        DEFAULT_PRESET_ID
        if DEFAULT_PRESET_ID in presets_by_id
        else next(iter(presets_by_id), None)
    )
    return JSONResponse(
        {
            "defaultPresetId": default_preset_id,
            "presets": [preset.model_dump() for preset in presets_by_id.values()],
        }
    )


@app.post("/configure")
async def configure(body: ConfigureRequest) -> JSONResponse:
    changed = False

    if body.openai_api_key is not None:
        store.openai_api_key = body.openai_api_key
        changed = True
    if body.openai_base_url is not None:
        store.openai_base_url = body.openai_base_url
        changed = True
    if body.anthropic_api_key is not None:
        store.anthropic_api_key = body.anthropic_api_key
        changed = True
    if body.anthropic_base_url is not None:
        store.anthropic_base_url = body.anthropic_base_url
        changed = True
    if body.google_api_key is not None:
        store.google_api_key = body.google_api_key
        changed = True
    if body.google_base_url is not None:
        store.google_base_url = body.google_base_url
        changed = True

    if changed:
        _reload_agents()

    return JSONResponse(
        {
            "status": "ok",
            "preset_count": len(_current_registry().presets_by_id),
            "preset_ids": list(_current_registry().presets_by_id.keys()),
        }
    )



# ──────────────────────────────────────────────
# Workspace file browser endpoints (V2, Phase 3)
# ──────────────────────────────────────────────


@app.get("/workspace/files")
async def list_directory(path: str = Query(default="", description="Subpath under workspace root")):
    """List files and directories at the given subpath."""
    try:
        resolved = resolve_workspace_path(store.snapshot().workspace_root, path)
    except ValueError:
        raise HTTPException(status_code=400, detail="path is outside workspace root")

    if not resolved.exists() or not resolved.is_dir():
        raise HTTPException(status_code=404, detail="directory not found")

    items = []
    for entry in resolved.iterdir():
        items.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0,
            "modified": entry.stat().st_mtime,
        })
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"path": path, "items": items}


@app.get("/workspace/file")
async def read_file(path: str = Query(..., description="Relative path to file under workspace root")):
    """Read a file's content as text."""
    try:
        resolved = resolve_workspace_path(store.snapshot().workspace_root, path)
    except ValueError:
        raise HTTPException(status_code=400, detail="path is outside workspace root")

    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=404, detail="file not found")

    try:
        content = resolved.read_text(encoding="utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=500, detail="failed to read file")

    return {"path": path, "content": content}


@app.get("/{agent_name}/health")
async def agent_health(agent_name: str):
    agent = _resolve_route_agent(agent_name)
    return {
        "status": "ok",
        "agent": {
            "name": agent.name,
        },
    }


@app.post("/{agent_name}")
async def run_agent(agent_name: str, input_data: RunAgentInput, request: Request):
    agent = _resolve_route_agent(agent_name).clone()
    encoder = EventEncoder(accept=request.headers.get("accept"))

    async def event_generator():
        async for event in agent.run(input_data):
            yield encoder.encode(event)

    return StreamingResponse(
        event_generator(),
        media_type=encoder.get_content_type(),
    )
