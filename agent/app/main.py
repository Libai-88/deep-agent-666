from fastapi import FastAPI
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from app.agent_factory import build_langgraph_agents
from app.config import load_settings
from app.presets import ALL_PRESETS, DEFAULT_PRESET_ID


settings = load_settings()
agents = build_langgraph_agents(settings)
app = FastAPI(title="deep-agent-666-agent")


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "preset_count": len(agents)})


@app.get("/presets")
async def presets() -> JSONResponse:
    return JSONResponse(
        {
            "defaultPresetId": DEFAULT_PRESET_ID,
            "presets": [preset.model_dump() for preset in ALL_PRESETS.values()],
        }
    )


for preset_id, agent in agents.items():
    add_langgraph_fastapi_endpoint(app=app, agent=agent, path=f"/{preset_id}")
