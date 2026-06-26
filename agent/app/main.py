from pathlib import Path
import logging

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ag_ui.core.events import (
    EventType,
    ReasoningMessageEndEvent,
    RunErrorEvent,
    RunStartedEvent,
    TextMessageEndEvent,
    ToolCallEndEvent,
)
from ag_ui.core.types import RunAgentInput
from ag_ui.encoder import EventEncoder
from copilotkit import CopilotKitRemoteEndpoint
from copilotkit.integrations.fastapi import add_fastapi_endpoint

from app.config import ConfigStore, load_settings, normalize_runtime_workspace_root
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
logger = logging.getLogger(__name__)

# CORS: allow browser-side @ag-ui/client HttpAgent to connect directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConfigureRequest(BaseModel):
    agent_workspace_root: str | None = None
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


def _safe_exception_message(exc: Exception) -> str:
    candidate = getattr(exc, "message", None)
    if isinstance(candidate, str) and candidate.strip():
        return candidate
    return str(exc)


def _classify_route_exception(exc: Exception) -> tuple[str | None, str]:
    message = _safe_exception_message(exc).lower()
    status_code = getattr(exc, "status_code", None)

    if (
        status_code == 429
        or "rate limit" in message
        or "quota" in message
        or "free-models-per-day" in message
    ):
        return "provider_rate_limited", "provider request failed: rate limited"

    if (
        status_code == 401
        or "invalid api key" in message
        or "incorrect api key" in message
        or "unauthorized" in message
    ):
        return "provider_auth_failed", "provider request failed: authentication failed"

    if (
        status_code == 403
        or "not available in your region" in message
        or "access denied" in message
        or "forbidden" in message
    ):
        return "provider_access_denied", "provider request failed: access denied"

    if (
        "model not found" in message
        or "invalid model" in message
        or "not a valid model" in message
    ):
        return "provider_model_unavailable", "provider request failed: model unavailable"

    return None, f"agent run failed: {exc.__class__.__name__} (see server logs)"


def _runtime_config_payload() -> dict[str, object]:
    snapshot = store.snapshot()
    return {
        "workspaceRoot": str(snapshot.workspace_root),
        "providers": {
            "openai": {
                "configured": bool(snapshot.openai_api_key),
                "baseUrl": snapshot.openai_base_url,
            },
            "anthropic": {
                "configured": bool(snapshot.anthropic_api_key),
                "baseUrl": snapshot.anthropic_base_url,
            },
            "google": {
                "configured": bool(snapshot.google_api_key),
                "baseUrl": snapshot.google_base_url,
            },
        },
    }


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


@app.get("/config")
async def config() -> JSONResponse:
    return JSONResponse(_runtime_config_payload())


@app.post("/configure")
async def configure(body: ConfigureRequest) -> JSONResponse:
    changed = False

    if body.agent_workspace_root is not None:
        try:
            store.workspace_root = normalize_runtime_workspace_root(
                body.agent_workspace_root
            )
        except ValueError as exc:
            return JSONResponse(
                {
                    "detail": str(exc),
                    "code": "workspace_root_invalid",
                },
                status_code=400,
            )
        changed = True

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
            **_runtime_config_payload(),
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
        saw_run_started = False
        open_text_messages: list[str] = []
        open_reasoning_messages: list[str] = []
        open_tool_calls: list[str] = []

        def _remember(items: list[str], value: str) -> None:
            if value not in items:
                items.append(value)

        def _forget(items: list[str], value: str) -> None:
            if value in items:
                items.remove(value)

        try:
            async for event in agent.run(input_data):
                if event.type == EventType.RUN_STARTED:
                    saw_run_started = True
                elif event.type == EventType.TEXT_MESSAGE_START:
                    _remember(open_text_messages, event.message_id)
                elif event.type == EventType.TEXT_MESSAGE_END:
                    _forget(open_text_messages, event.message_id)
                elif event.type == EventType.REASONING_MESSAGE_START:
                    _remember(open_reasoning_messages, event.message_id)
                elif event.type == EventType.REASONING_MESSAGE_END:
                    _forget(open_reasoning_messages, event.message_id)
                elif event.type == EventType.TOOL_CALL_START:
                    _remember(open_tool_calls, event.tool_call_id)
                elif event.type == EventType.TOOL_CALL_END:
                    _forget(open_tool_calls, event.tool_call_id)

                yield encoder.encode(event)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Direct AG-UI route '%s' failed", agent_name)

            if not saw_run_started:
                yield encoder.encode(
                    RunStartedEvent(
                        thread_id=input_data.thread_id,
                        run_id=input_data.run_id,
                    )
                )

            for message_id in list(open_text_messages):
                yield encoder.encode(TextMessageEndEvent(message_id=message_id))
            for message_id in list(open_reasoning_messages):
                yield encoder.encode(
                    ReasoningMessageEndEvent(message_id=message_id)
                )
            for tool_call_id in list(open_tool_calls):
                yield encoder.encode(ToolCallEndEvent(tool_call_id=tool_call_id))

            code, message = _classify_route_exception(exc)
            yield encoder.encode(
                RunErrorEvent(
                    message=message,
                    code=code,
                )
            )

    return StreamingResponse(
        event_generator(),
        media_type=encoder.get_content_type(),
    )
