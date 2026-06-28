from pathlib import Path
import logging
import typing

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
from app.permissions import PermissionMode
from app.presets import AgentPreset
from app.presets import DEFAULT_PRESET_ID
from app.provider_registry import (
    build_legacy_provider_summary,
    find_provider_profile,
    normalize_provider_registry_payload,
    serialize_model_profiles,
    serialize_provider_profiles,
)
from app.agent_factory import build_runtime_model
from app.runtime_registry import (
    LiveAgentAccessor,
    RuntimeAgentRegistry,
    build_runtime_registry,
)
from app.state import RuntimeControlAction
from app.state import RuntimeControlSnapshot
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
    providerProfiles: list[dict[str, object]] | None = None
    modelProfiles: list[dict[str, object]] | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    anthropic_api_key: str | None = None
    anthropic_base_url: str | None = None
    google_api_key: str | None = None
    google_base_url: str | None = None


class RunControlRequest(BaseModel):
    thread_id: str
    action: RuntimeControlAction
    run_id: str | None = None
    plan_patch: str | None = None


class ProviderProbeRequest(BaseModel):
    providerProfile: dict[str, object]
    modelProfile: dict[str, object]


class ThreadRuntimeEntry(typing.TypedDict):
    """线程级运行时控制存储。"""

    thread_id: str
    runtime_control: RuntimeControlSnapshot
    pending_command: str | None


runtime_registry: RuntimeAgentRegistry = build_runtime_registry(
    settings,
    store.provider_registry_snapshot,
)
THREAD_RUNTIME: dict[str, ThreadRuntimeEntry] = {}


def _current_registry() -> RuntimeAgentRegistry:
    return runtime_registry


def build_runtime_control_snapshot(
    snapshot: RuntimeControlSnapshot,
) -> RuntimeControlSnapshot:
    """返回当前运行时控制快照。"""

    return snapshot


def get_thread_runtime_snapshot(thread_id: str) -> RuntimeControlSnapshot | None:
    entry = THREAD_RUNTIME.get(thread_id)
    return None if entry is None else entry["runtime_control"]


def record_thread_runtime_snapshot(
    thread_id: str,
    snapshot: RuntimeControlSnapshot,
) -> None:
    THREAD_RUNTIME[thread_id] = {
        "thread_id": thread_id,
        "runtime_control": build_runtime_control_snapshot(snapshot),
        "pending_command": None,
    }


sdk = CopilotKitRemoteEndpoint(agents=LiveAgentAccessor(_current_registry))
add_fastapi_endpoint(app, sdk, "/copilotkit")


def _reload_agents() -> None:
    """Rebuild the live runtime registry after /configure."""
    global runtime_registry
    runtime_registry = build_runtime_registry(
        store.snapshot(),
        store.provider_registry_snapshot,
    )


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
    snapshot = store.provider_registry_snapshot
    return {
        "workspaceRoot": str(snapshot.workspace_root),
        "providerProfiles": serialize_provider_profiles(snapshot),
        "modelProfiles": serialize_model_profiles(snapshot),
        "providers": build_legacy_provider_summary(snapshot),
    }


def probe_provider_model(
    provider_profile_payload: dict[str, object],
    model_profile_payload: dict[str, object],
) -> dict[str, object]:
    current_profile = find_provider_profile(
        store.provider_registry_snapshot,
        str(provider_profile_payload.get("id", "")),
    )
    merged_provider_profile = dict(provider_profile_payload)
    if current_profile is not None:
        if not isinstance(merged_provider_profile.get("apiKey"), str) and current_profile.api_key:
            merged_provider_profile["apiKey"] = current_profile.api_key
        if not isinstance(merged_provider_profile.get("baseUrl"), str) and current_profile.base_url:
            merged_provider_profile["baseUrl"] = current_profile.base_url
        if not isinstance(merged_provider_profile.get("authScheme"), str):
            merged_provider_profile["authScheme"] = current_profile.auth_scheme
        if not isinstance(merged_provider_profile.get("label"), str):
            merged_provider_profile["label"] = current_profile.label
        if not isinstance(merged_provider_profile.get("protocol"), str):
            merged_provider_profile["protocol"] = current_profile.protocol
        if not isinstance(merged_provider_profile.get("headers"), dict):
            merged_provider_profile["headers"] = current_profile.headers
        if not isinstance(merged_provider_profile.get("enabled"), bool):
            merged_provider_profile["enabled"] = current_profile.enabled

    snapshot = normalize_provider_registry_payload(
        {
            "workspaceRoot": str(store.snapshot().workspace_root),
            "providerProfiles": [merged_provider_profile],
            "modelProfiles": [model_profile_payload],
        }
    )
    provider_profile = find_provider_profile(
        snapshot,
        str(merged_provider_profile.get("id", "")),
    )
    if provider_profile is None:
        raise ValueError("provider probe payload did not include a valid provider")

    model_profile = snapshot.model_profiles[0]
    provider = (
        "openai"
        if provider_profile.protocol == "openai-compatible"
        else provider_profile.protocol
    )
    model = build_runtime_model(
        provider=provider,
        model_name=model_profile.model_name,
        settings=store.snapshot(),
        provider_id=provider_profile.id,
        registry_snapshot=snapshot,
    )
    model.invoke("Reply with OK.")
    return {
        "status": "ready",
        "code": None,
        "message": "Provider responded successfully.",
        "providerId": provider_profile.id,
        "modelId": model_profile.id,
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

    if body.providerProfiles is not None or body.modelProfiles is not None:
        current_snapshot = store.provider_registry_snapshot
        incoming_provider_profiles = (
            body.providerProfiles
            if body.providerProfiles is not None
            else [profile.model_dump() for profile in current_snapshot.provider_profiles]
        )
        incoming_model_profiles = (
            body.modelProfiles
            if body.modelProfiles is not None
            else [profile.model_dump() for profile in current_snapshot.model_profiles]
        )

        builtin_provider_ids = {"openai", "anthropic", "google"}
        merged_provider_profiles = [
            profile.model_dump()
            for profile in current_snapshot.provider_profiles
            if profile.id in builtin_provider_ids
        ]
        merged_provider_profiles.extend(
            profile
            for profile in incoming_provider_profiles
            if str(profile.get("id")) not in builtin_provider_ids
        )

        merged_model_profiles = [
            profile.model_dump()
            for profile in current_snapshot.model_profiles
            if profile.provider_id in builtin_provider_ids
        ]
        merged_model_profiles.extend(
            profile
            for profile in incoming_model_profiles
            if str(
                profile.get("providerId", profile.get("provider_id", ""))
            ) not in builtin_provider_ids
        )
        try:
            next_snapshot = normalize_provider_registry_payload(
                {
                    "workspaceRoot": str(store.snapshot().workspace_root),
                    "providerProfiles": merged_provider_profiles,
                    "modelProfiles": merged_model_profiles,
                }
            )
        except ValueError as exc:
            return JSONResponse(
                {
                    "detail": str(exc),
                    "code": "workspace_root_invalid",
                },
                status_code=400,
            )
        store.provider_registry_snapshot = next_snapshot
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


@app.post("/providers/probe")
async def provider_probe(body: ProviderProbeRequest) -> JSONResponse:
    try:
        result = probe_provider_model(body.providerProfile, body.modelProfile)
    except ValueError as exc:
        return JSONResponse(
            {
                "status": "invalid_config",
                "code": "provider_invalid_config",
                "message": str(exc),
            },
            status_code=400,
        )
    except Exception as exc:  # noqa: BLE001
        code, message = _classify_route_exception(exc)
        status = {
            "provider_auth_failed": "auth_failed",
            "provider_access_denied": "access_denied",
            "provider_model_unavailable": "model_unavailable",
            None: "unreachable",
        }[code]
        return JSONResponse(
            {
                "status": status,
                "code": code,
                "message": message,
            },
            status_code=200,
        )

    return JSONResponse(result)


@app.post("/control")
async def run_control(body: RunControlRequest) -> JSONResponse:
    snapshot = get_thread_runtime_snapshot(body.thread_id)
    if snapshot is None:
        return JSONResponse(
            {
                "status": "error",
                "code": "thread_runtime_not_found",
                "message": "runtime snapshot not found for thread",
            },
            status_code=404,
        )

    return JSONResponse(
        {
            "status": "ok",
            "threadId": body.thread_id,
            "action": body.action,
            "runtimeControl": build_runtime_control_snapshot(snapshot),
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
