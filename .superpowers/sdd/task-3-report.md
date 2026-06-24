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

## Task 3 Follow-Up Fix: Provider Integrations

### Validated finding

The reviewer finding was correct for this codebase:

- The backend advertised OpenAI, Anthropic, and Google presets.
- `agent/pyproject.toml` did not explicitly declare the matching LangChain provider integrations.
- The lazy model wrapper in `agent/app/agent_factory.py` allowed startup and tests to pass while deferring provider failures to first real preset use.

### Red

Added a regression test in `agent/tests/test_agent_factory.py`:

- `test_provider_integrations_exist_for_advertised_presets`

Ran:

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py::test_provider_integrations_exist_for_advertised_presets -v
```

Observed expected failure:

- `AssertionError: assert None is not None`
- Missing module: `langchain_openai`

### Fix applied

- Added explicit provider dependencies to `agent/pyproject.toml`:
  - `langchain-openai>=1.0.0,<2.0.0`
  - `langchain-anthropic>=1.0.0,<2.0.0`
  - `langchain-google-genai>=4.0.0,<5.0.0`
- Removed the lazy preset model wrapper from `agent/app/agent_factory.py`.
- Replaced it with eager provider-backed model construction using `init_chat_model(...)`.
- Mapped the preset `google:` prefix to LangChain's `google_genai` provider name.
- Passed provider API keys from `AgentSettings` into model construction so the eager graph build path is valid for all advertised providers.
- Tightened `test_build_graph_map_covers_every_preset` to supply OpenAI, Anthropic, and Google API keys.

### Verification

#### Focused Task 3 tests

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_workspace_tools.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_documents.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py -v
```

Result:

- `6 passed in 9.68s`

#### Broader backend verification

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests -v
```

Result:

- `14 passed in 6.81s`

#### Multi-provider service import sanity check

Ran from `D:\AgentBuild\.worktrees\deepagents-foundation\agent` with:

```powershell
$env:AGENT_WORKSPACE_ROOT='D:\AgentBuild\.worktrees\deepagents-foundation'
$env:OPENAI_API_KEY='test-key'
$env:ANTHROPIC_API_KEY='test-key'
$env:GOOGLE_API_KEY='test-key'
uv run python -c "from app.main import app, agents; print(app.title); print(len(agents)); print(sorted(route.path for route in app.routes if route.path in ['/health', '/presets', '/openai-balanced', '/anthropic-balanced', '/google-balanced']))"
```

Result:

- App title: `deep-agent-666-agent`
- Preset agent count: `9`
- Verified multi-provider routes:
  - `'/anthropic-balanced'`
  - `'/google-balanced'`
  - `'/health'`
  - `'/openai-balanced'`
  - `'/presets'`

## Task 3 Follow-Up Fix: Partial Provider Startup

### Validated finding

The remaining reviewer finding was correct:

- The service eagerly constructed graphs for every advertised preset at import/startup time.
- After the provider integration fix, startup still failed if only a subset of provider API keys was configured.
- This made `app.main` unusable for partial-provider environments even though the product-level preset catalog can legitimately contain more providers than are locally configured.

### Red

Added a startup-focused regression test in `agent/tests/test_agent_factory.py`:

- `test_main_starts_with_only_openai_configured`

Ran:

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py::test_main_starts_with_only_openai_configured -v
```

Observed expected failure:

- Importing `app.main` with only `OPENAI_API_KEY` set failed during eager Google graph construction.
- The concrete exception was the Gemini API key validation failure from `ChatGoogleGenerativeAI`.

### Fix applied

- Added `available_presets(settings)` in `agent/app/agent_factory.py` to filter the full preset catalog down to providers that currently have credentials configured.
- Updated `build_graph_map(settings)` and `build_langgraph_agents(settings)` to construct runtime graphs and agents only for the configured provider subset.
- Kept `ALL_PRESETS` unchanged as the product-level full catalog definition.
- Updated `agent/app/main.py` to expose `/presets` metadata only for the configured provider subset.
- Kept `defaultPresetId` stable when the configured subset still includes `openai-balanced`; otherwise it falls back to the first available configured preset or `null` if none are configured.

### Verification

#### Focused partial-provider regression

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py::test_main_starts_with_only_openai_configured -v
```

Result:

- `1 passed in 4.27s`

#### Focused Task 3 tests

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_workspace_tools.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_documents.py D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests\test_agent_factory.py -v
```

Result:

- `7 passed in 8.47s`

#### Broader backend verification

```powershell
uv run --project D:\AgentBuild\.worktrees\deepagents-foundation\agent pytest D:\AgentBuild\.worktrees\deepagents-foundation\agent\tests -v
```

Result:

- `15 passed in 8.72s`

#### One-provider startup sanity check

Ran from `D:\AgentBuild\.worktrees\deepagents-foundation\agent` with:

```powershell
$env:AGENT_WORKSPACE_ROOT='D:\AgentBuild\.worktrees\deepagents-foundation'
$env:OPENAI_API_KEY='test-key'
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:GOOGLE_API_KEY -ErrorAction SilentlyContinue
uv run python -c "from app.main import app, agents, presets_by_id; print(app.title); print(sorted(agents)); print(sorted(presets_by_id)); print(sorted(route.path for route in app.routes if route.path in ['/health', '/presets', '/openai-balanced', '/anthropic-balanced', '/google-balanced']))"
```

Result:

- App title: `deep-agent-666-agent`
- Runtime agents: `['openai-balanced', 'openai-full-access', 'openai-read-only']`
- Exposed preset metadata: `['openai-balanced', 'openai-full-access', 'openai-read-only']`
- Verified routes: `['/health', '/openai-balanced', '/presets']`
