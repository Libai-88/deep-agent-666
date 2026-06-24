# Task 3 Report: Backend Tools and Deep Agents FastAPI Service

## Scope Delivered

Implemented the Task 3 backend core in the allowed code paths:

- `agent/app/tools/__init__.py`
- `agent/app/tools/workspace.py`
- `agent/app/tools/documents.py`
- `agent/app/agent_factory.py`
- `agent/app/main.py`
- `agent/tests/test_workspace_tools.py`
- `agent/tests/test_documents.py`
- `agent/tests/test_agent_factory.py`

## Requirements Applied

- Added workspace-scoped backend tools for listing, searching, reading, writing, replacing text, and PowerShell command execution.
- Added document reading support for plain text/markdown plus `.docx` and `.pdf`.
- Added one Deep Agents graph per preset and a LangGraph AG-UI agent map for CopilotKit/AG-UI integration.
- Added a FastAPI app with `/health`, `/presets`, and per-preset AG-UI endpoints via `add_langgraph_fastapi_endpoint`.
- Kept command execution Windows-first and workspace-root constrained.

## TDD Record

### Red

Added the required failing tests first:

- `agent/tests/test_workspace_tools.py`
- `agent/tests/test_documents.py`
- `agent/tests/test_agent_factory.py`

Ran:

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_workspace_tools.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_documents.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py -v
```

Observed expected red state:

- `ModuleNotFoundError: No module named 'app.tools'`
- `ModuleNotFoundError: No module named 'app.agent_factory'`

### Green

Implemented the minimum production code to satisfy the tests.

Ran the same focused command again after implementation.

Intermediate failure found:

- `build_graph_map` eagerly resolved provider-specific LangChain integrations.
- The local project environment did not include `langchain-openai`, so graph construction failed before runtime use.

Fix applied:

- Switched graph creation to a lazy preset chat model wrapper in `agent/app/agent_factory.py`.
- Preset model strings remain intact, but provider resolution is deferred until actual model use.

Re-ran the focused command and reached green:

- `5 passed in 5.09s`

## Verification

### Focused Task 3 tests

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_workspace_tools.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_documents.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py -v
```

Result:

- `5 passed in 5.09s`

### Broader backend test verification

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests -v
```

Result:

- `13 passed in 4.68s`

### FastAPI service import sanity check

Ran from `D:\AgentBuild\.worktrees\deepagents-foundation\agent` with:

```powershell
$env:AGENT_WORKSPACE_ROOT='D:\AgentBuild\.worktrees\deepagents-foundation'
$env:OPENAI_API_KEY='test-key'
uv run python -c "from app.main import app, agents; print(app.title); print(len(agents)); print(sorted(route.path for route in app.routes if route.path in ['/health', '/presets', '/openai-balanced']))"
```

Result:

- App title: `deep-agent-666-agent`
- Preset agent count: `9`
- Verified routes: `['/health', '/openai-balanced', '/presets']`

## Notes

- `uv sync --project ... --extra dev` was needed locally so `uv run ... pytest` would use the project environment instead of a global pytest without the pinned dependencies.
- No code outside the task-owned backend files was modified.

## Commit

Planned commit message from the task brief:

```text
feat: add deep agents backend service
```
