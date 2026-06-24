from fastapi import FastAPI
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from app.agent_factory import available_presets, build_langgraph_agents
from app.config import load_settings
from app.presets import DEFAULT_PRESET_ID


settings = load_settings()
presets_by_id = available_presets(settings)
agents = build_langgraph_agents(settings)
app = FastAPI(title="deep-agent-666-agent")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "preset_count": len(agents)})


@app.get("/presets")
async def presets() -> JSONResponse:
    default_preset_id = DEFAULT_PRESET_ID if DEFAULT_PRESET_ID in presets_by_id else next(iter(presets_by_id), None)
    return JSONResponse(
        {
            "defaultPresetId": default_preset_id,
            "presets": [preset.model_dump() for preset in presets_by_id.values()],
        }
    )


for preset_id, agent in agents.items():
    add_langgraph_fastapi_endpoint(app=app, agent=agent, path=f"/{preset_id}")
