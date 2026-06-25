from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent

from app.agent_factory import available_presets, build_langgraph_agents, build_v2_coordinator
from app.config import ConfigStore, load_settings
from app.permissions import PermissionMode
from app.presets import DEFAULT_PRESET_ID
from app.tools.workspace import resolve_workspace_path


settings = load_settings()
store = ConfigStore(settings)
presets_by_id = available_presets(settings)
agents = build_langgraph_agents(settings)
app = FastAPI(title="deep-agent-666-agent")


class ConfigureRequest(BaseModel):
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    google_api_key: str | None = None
    google_base_url: str | None = None


def _reload_agents() -> None:
    global presets_by_id, agents
    presets_by_id = available_presets(settings)
    agents = build_langgraph_agents(settings)
    # Coordinators are rebuilt once at module level below (and on configure via app.state)

app.state.coordinator_agents = {}


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "preset_count": len(agents)})


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
            "preset_count": len(agents),
            "preset_ids": list(presets_by_id.keys()),
        }
    )


for preset_id, agent in agents.items():
    add_langgraph_fastapi_endpoint(app=app, agent=agent, path=f"/{preset_id}")

# Register V2 coordinator AG-UI endpoints
# Wrapped in a callable so _reload_agents can re-run on configure
_COORDINATOR_PATHS: set[str] = set()


def _register_coordinators() -> None:
    """Register or re-register coordinator endpoints for available presets.

    Note: FastAPI does not support removing routes at runtime, so old coordinator
    endpoints from a previous registration remain. They will 404 for removed presets.
    A server restart is the cleanest way to fully reset after /configure changes.
    """
    for preset_id, preset in presets_by_id.items():
        if preset.permission_mode not in (PermissionMode.BALANCED, PermissionMode.FULL_ACCESS):
            continue

        coord_path = f"/coordinator-{preset_id}"
        if coord_path in _COORDINATOR_PATHS:
            continue  # Already registered

        v2_model = preset.model.replace(":", "/", 1)
        coordinator_graph = build_v2_coordinator(
            model=v2_model,
            permission_mode=preset.permission_mode.value,
        )

        coordinator_agent = LangGraphAGUIAgent(
            name=f"coordinator-{preset_id}",
            description=f"Coordinator ({preset.label})",
            graph=coordinator_graph,
        )

        add_langgraph_fastapi_endpoint(
            app=app,
            agent=coordinator_agent,
            path=coord_path,
        )
        _COORDINATOR_PATHS.add(coord_path)


_register_coordinators()


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
