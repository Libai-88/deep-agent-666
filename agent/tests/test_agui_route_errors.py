import importlib
import sys

from fastapi.testclient import TestClient
from ag_ui.core.events import (
    RunStartedEvent,
    TextMessageContentEvent,
    TextMessageStartEvent,
)


def _reload_main(monkeypatch, tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    registry_path = tmp_path / "provider-registry.json"
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(workspace))
    monkeypatch.setenv("AGENT_PROVIDER_REGISTRY_PATH", str(registry_path))
    sys.modules.pop("app.main", None)
    import app.main as main_module
    return importlib.reload(main_module)


class _ProviderAccessDeniedError(RuntimeError):
    def __init__(self) -> None:
        super().__init__(
            "Error code: 403 - {'error': {'message': 'This model is not available in your region.', 'code': 403}}",
        )
        self.status_code = 403
        self.message = str(self)
        self.body = {
            "message": "This model is not available in your region.",
            "code": 403,
        }
        self.code = 403


class _FailingAgent:
    name = "openai-balanced"

    def __init__(self, mode: str) -> None:
        self._mode = mode

    def clone(self):
        return _FailingAgent(self._mode)

    async def run(self, input_data):
        if self._mode == "immediate-error":
            raise _ProviderAccessDeniedError()

        yield RunStartedEvent(
            thread_id=input_data.thread_id,
            run_id=input_data.run_id,
        )

        if self._mode == "provider-error":
            raise _ProviderAccessDeniedError()

        yield TextMessageStartEvent(message_id="assistant-1", role="assistant")
        yield TextMessageContentEvent(
            message_id="assistant-1",
            delta="partial output",
        )
        raise RuntimeError("unexpected mid-stream failure")


def test_direct_agui_route_emits_run_error_for_provider_access_denied(
    monkeypatch,
    tmp_path,
) -> None:
    main_module = _reload_main(monkeypatch, tmp_path)
    monkeypatch.setattr(
        main_module,
        "_resolve_route_agent",
        lambda _name: _FailingAgent("provider-error"),
    )
    client = TestClient(main_module.app)

    response = client.post(
        "/openai-balanced",
        json={
            "threadId": "thread-provider-error",
            "runId": "run-provider-error",
            "messages": [{"id": "m1", "role": "user", "content": "hello"}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
        headers={"accept": "text/event-stream"},
    )

    assert response.status_code == 200
    assert '"type":"RUN_STARTED"' in response.text
    assert '"type":"RUN_ERROR"' in response.text
    assert '"code":"provider_access_denied"' in response.text
    assert '"type":"RUN_FINISHED"' not in response.text


def test_direct_agui_route_closes_open_text_frames_before_run_error(
    monkeypatch,
    tmp_path,
) -> None:
    main_module = _reload_main(monkeypatch, tmp_path)
    monkeypatch.setattr(
        main_module,
        "_resolve_route_agent",
        lambda _name: _FailingAgent("mid-text-error"),
    )
    client = TestClient(main_module.app)

    response = client.post(
        "/openai-balanced",
        json={
            "threadId": "thread-midstream-error",
            "runId": "run-midstream-error",
            "messages": [{"id": "m1", "role": "user", "content": "hello"}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
        headers={"accept": "text/event-stream"},
    )

    text = response.text
    end_index = text.index('"type":"TEXT_MESSAGE_END"')
    error_index = text.index('"type":"RUN_ERROR"')

    assert end_index < error_index
    assert '"type":"RUN_FINISHED"' not in text


def test_direct_agui_route_synthesizes_run_started_before_terminal_error(
    monkeypatch,
    tmp_path,
) -> None:
    main_module = _reload_main(monkeypatch, tmp_path)
    monkeypatch.setattr(
        main_module,
        "_resolve_route_agent",
        lambda _name: _FailingAgent("immediate-error"),
    )
    client = TestClient(main_module.app)

    response = client.post(
        "/openai-balanced",
        json={
            "threadId": "thread-immediate-error",
            "runId": "run-immediate-error",
            "messages": [{"id": "m1", "role": "user", "content": "hello"}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
        headers={"accept": "text/event-stream"},
    )

    text = response.text
    started_index = text.index('"type":"RUN_STARTED"')
    error_index = text.index('"type":"RUN_ERROR"')

    assert started_index < error_index
