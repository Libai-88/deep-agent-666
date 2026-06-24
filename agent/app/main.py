from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from app.agent_factory import available_presets, build_langgraph_agents
from app.config import ConfigStore, load_settings
from app.presets import DEFAULT_PRESET_ID


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
