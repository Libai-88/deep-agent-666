from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint

from app.agent_factory import available_presets, build_langgraph_agents, build_v2_coordinator
from app.config import ConfigStore, load_settings
from app.permissions import PermissionMode
from app.presets import DEFAULT_PRESET_ID
from app.tools.workspace import resolve_workspace_path


settings = load_settings()
store = ConfigStore(settings)
presets_by_id = available_presets(settings)
app = FastAPI(title="deep-agent-666-agent")


class ConfigureRequest(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    google_api_key: str | None = None
    google_base_url: str | None = None


# Build V1 agents (wrapped in LangGraphAGUIAgent)
v1_agents = build_langgraph_agents(settings)

# Register V1 agents with direct paths for frontend LangGraphHttpAgent compatibility
for preset_id, agent in v1_agents.items():
    add_langgraph_fastapi_endpoint(app=app, agent=agent, path=f"/{preset_id}")

# Build coordinator agents and register via CopilotKitRemoteEndpoint
coordinator_agents: list[LangGraphAGUIAgent] = []
for preset_id, preset in presets_by_id.items():
    if preset.permission_mode not in (PermissionMode.BALANCED, PermissionMode.FULL_ACCESS):
        continue
    v2_model = preset.model.replace(":", "/", 1)
    try:
        coord_graph = build_v2_coordinator(
            model=v2_model,
            permission_mode=preset.permission_mode.value,
        )
        coordinator_agents.append(LangGraphAGUIAgent(
            name=f"coordinator-{preset_id}",
            description=f"Coordinator ({preset.label})",
            graph=coord_graph,
        ))
    except ValueError:
        continue

all_agents = list(v1_agents.values()) + coordinator_agents
sdk = CopilotKitRemoteEndpoint(agents=all_agents)
add_fastapi_endpoint(app, sdk, "/copilotkit")


def _reload_agents() -> None:
    """Reload V1 presets after /configure.

    Note: CopilotKitRemoteEndpoint routes cannot be removed at runtime.
    A server restart is required for coordinator endpoint changes to take full effect.
    """
    global presets_by_id
    presets_by_id = available_presets(settings)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "preset_count": len(all_agents), "agents": [a.name for a in all_agents]})


@app.get("/presets")
async def presets() -> JSONResponse:
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
            "preset_count": len(presets_by_id),
            "preset_ids": list(presets_by_id.keys()),
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
