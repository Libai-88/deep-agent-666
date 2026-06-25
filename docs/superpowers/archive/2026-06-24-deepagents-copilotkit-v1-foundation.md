# Deep Agents + CopilotKit V1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first single-assistant MVP for Windows users with a Python Deep Agents backend, a CopilotKit-powered Next.js frontend, resumable local threads, switchable model presets, and approval-gated local tools.

**Architecture:** Run one Python FastAPI process that mounts multiple Deep Agents AG-UI endpoints, one preset per model/permission combination, so model choice stays officially supported without rebuilding graphs on every request. Run one Next.js App Router app that hosts the CopilotKit runtime with a local SQLite runner, uses explicit `threadId` values for reconnect, and presents one chat-first assistant whose selected preset is encoded in the chosen runtime `agentId`.

**Tech Stack:** Python 3.11+, Deep Agents 0.6.11, LangGraph 1.2.6, CopilotKit Python 0.1.94, `ag-ui-langgraph` 0.0.42, FastAPI 0.138.0, Uvicorn 0.49.0, Next.js 16.2.9, React 19.2.7, TypeScript 6.0.3, CopilotKit JS 1.61.1, `@copilotkit/sqlite-runner` 1.61.1, `better-sqlite3` 12.11.1, Vitest 4.1.9, Playwright 1.61.1.

## Global Constraints

- `local-first`
- `web + future Windows desktop compatible`
- `single-agent from a product perspective`
- `balanced across code, terminal, file, and office-document workflows`
- `strong enough in full local task execution to prove product value`
- `The first version exposes one primary agent to the user.`
- `The product will use switchable permission modes rather than a single trust model.`
- `The system should support multiple model providers.`
- `React + Next.js`
- Developer and runtime shell support is Windows-only in V1, so all command execution must target PowerShell.
- V1 must not depend on CopilotKit Intelligence or `useThreads`; thread persistence must come from explicit `threadId` values plus a local SQLite runner.

---

## File Structure

### Root

- Create: `package.json`
  Root orchestration scripts for frontend, backend, test, and dev startup.
- Create: `.env.example`
  Shared environment contract for backend model keys, workspace root, backend URL, and SQLite file path.
- Modify: `.gitignore`
  Ignore local env files, build output, virtualenv, SQLite files, and Playwright artifacts.
- Create: `tests/smoke/test_repo_layout.py`
  Repository skeleton smoke test that asserts required top-level files and directories exist.
- Create: `README.md`
  Runbook for Windows setup, local dev, tests, and architecture notes.

### Python Backend

- Create: `agent/pyproject.toml`
  Python package manifest and test tooling.
- Create: `agent/app/__init__.py`
  Package marker.
- Create: `agent/app/config.py`
  Environment loading and immutable backend settings.
- Create: `agent/app/permissions.py`
  Permission mode enum plus interrupt and tool-allowlist policy.
- Create: `agent/app/presets.py`
  Preset catalog for model-provider and permission-mode combinations.
- Create: `agent/app/tools/__init__.py`
  Tool module exports.
- Create: `agent/app/tools/workspace.py`
  Workspace-scoped list/read/search/write/replace/command tools with Windows-safe PowerShell execution.
- Create: `agent/app/tools/documents.py`
  Local document reader for `.txt`, `.md`, `.json`, `.docx`, and `.pdf`.
- Create: `agent/app/agent_factory.py`
  Graph builder that creates one Deep Agent graph per preset.
- Create: `agent/app/main.py`
  FastAPI entrypoint with `/health`, `/presets`, and AG-UI endpoints per preset.
- Create: `agent/tests/test_config_and_presets.py`
  Tests for env loading and preset coverage.
- Create: `agent/tests/test_permissions.py`
  Tests for allowlists and interrupt rules.
- Create: `agent/tests/test_workspace_tools.py`
  Tests for path scoping, file mutation, and PowerShell command behavior.
- Create: `agent/tests/test_documents.py`
  Tests for document reader behavior.
- Create: `agent/tests/test_agent_factory.py`
  Tests for graph/preset wiring and endpoint coverage.

### Next.js Frontend

- Create: `web/package.json`
  Frontend dependencies and scripts.
- Create: `web/tsconfig.json`
  TypeScript configuration.
- Create: `web/next.config.ts`
  Next.js configuration.
- Create: `web/vitest.config.ts`
  Vitest configuration for jsdom component tests.
- Create: `web/playwright.config.ts`
  Playwright configuration for browser smoke tests.
- Create: `web/src/app/globals.css`
  Global styling with a restrained Claude/Codex-like visual system.
- Create: `web/src/app/layout.tsx`
  Root server layout.
- Create: `web/src/app/providers.tsx`
  Client-only CopilotKit provider setup.
- Create: `web/src/app/page.tsx`
  Landing page that mounts the agent workbench.
- Create: `web/src/app/api/copilotkit/[...slug]/route.ts`
  Next.js runtime route using `createCopilotRuntimeHandler`.
- Create: `web/src/lib/agent-presets.ts`
  Frontend mirror of preset metadata and preset-resolution helpers.
- Create: `web/src/lib/copilot-runtime.ts`
  Runtime construction helpers and runtime agent map.
- Create: `web/src/lib/thread-registry.ts`
  Browser-local thread list persistence keyed by explicit `threadId`.
- Create: `web/src/components/agent-workbench.tsx`
  Main chat-first surface, active thread state, and preset selection.
- Create: `web/src/components/thread-sidebar.tsx`
  Local thread list and create/select interactions.
- Create: `web/src/components/settings-panel.tsx`
  Model-provider and permission-mode selector tied to thread metadata.
- Create: `web/src/components/interrupt-approval.tsx`
  `useInterrupt` approval card for Deep Agents tool-call interrupts.
- Create: `web/src/components/tool-call-renderers.tsx`
  Custom renderer cards for command, document, and file tools.
- Create: `web/src/lib/__tests__/agent-presets.test.ts`
  Tests for preset resolution logic.
- Create: `web/src/lib/__tests__/copilot-runtime.test.ts`
  Tests for runtime helper output and agent URL mapping.
- Create: `web/src/lib/__tests__/thread-registry.test.ts`
  Tests for local thread persistence.
- Create: `web/src/components/__tests__/agent-workbench.test.tsx`
  React smoke tests for preset switching and thread rendering.
- Create: `web/tests/e2e/chat-smoke.spec.ts`
  Browser smoke test for page load, thread creation, and visible approval UI shell.

## Task 1: Repository Foundation

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Modify: `.gitignore`
- Test: `tests/smoke/test_repo_layout.py`

**Interfaces:**
- Consumes: none
- Produces:
  - Root npm scripts:
    - `npm run dev:web`
    - `npm run dev:agent`
    - `npm run dev`
    - `npm run test:web`
    - `npm run test:agent`
    - `npm run test`
  - Environment keys:
    - `AGENT_BASE_URL`
    - `AGENT_WORKSPACE_ROOT`
    - `COPILOTKIT_THREADS_DB_PATH`
    - `OPENAI_API_KEY`
    - `ANTHROPIC_API_KEY`
    - `GOOGLE_API_KEY`
    - `NEXT_PUBLIC_DEFAULT_AGENT_PRESET`

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/smoke/test_repo_layout.py
from pathlib import Path


REQUIRED_PATHS = [
    Path("package.json"),
    Path(".env.example"),
    Path("agent"),
    Path("web"),
]


def test_required_repository_paths_exist() -> None:
    missing = [str(path) for path in REQUIRED_PATHS if not path.exists()]
    assert missing == [], f"missing repository paths: {missing}"
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `python -m pytest tests/smoke/test_repo_layout.py -v`

Expected: FAIL with `missing repository paths` showing `package.json`, `.env.example`, `agent`, or `web`.

- [ ] **Step 3: Write the minimal root scaffolding**

```json
{
  "name": "deep-agent-666",
  "private": true,
  "scripts": {
    "dev:web": "npm --prefix web run dev",
    "dev:agent": "uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload",
    "dev": "concurrently -n web,agent -c cyan,green \"npm run dev:web\" \"npm run dev:agent\"",
    "test:web": "npm --prefix web run test",
    "test:agent": "uv run --project agent pytest",
    "test": "python -m pytest tests/smoke/test_repo_layout.py -v && npm run test:agent && npm run test:web",
    "typecheck:web": "npm --prefix web run typecheck",
    "lint:web": "npm --prefix web run lint"
  },
  "devDependencies": {
    "concurrently": "^10.0.3"
  }
}
```

```dotenv
# .env.example
AGENT_BASE_URL=http://127.0.0.1:8123
AGENT_WORKSPACE_ROOT=D:/AgentBuild
COPILOTKIT_THREADS_DB_PATH=./data/threads.db
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
NEXT_PUBLIC_DEFAULT_AGENT_PRESET=openai-balanced
```

```gitignore
# append to .gitignore
/data/
/agent/.venv/
/web/.next/
/web/node_modules/
/web/playwright-report/
/web/test-results/
.env
.env.local
.env.*.local
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `python -m pytest tests/smoke/test_repo_layout.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json .env.example .gitignore tests/smoke/test_repo_layout.py
git commit -m "chore: add repository foundation"
```

### Task 2: Backend Config, Presets, and Permission Policy

**Files:**
- Create: `agent/pyproject.toml`
- Create: `agent/app/__init__.py`
- Create: `agent/app/config.py`
- Create: `agent/app/permissions.py`
- Create: `agent/app/presets.py`
- Test: `agent/tests/test_config_and_presets.py`
- Test: `agent/tests/test_permissions.py`

**Interfaces:**
- Consumes:
  - `AGENT_WORKSPACE_ROOT: str`
  - `OPENAI_API_KEY: str | None`
  - `ANTHROPIC_API_KEY: str | None`
  - `GOOGLE_API_KEY: str | None`
- Produces:
  - `class AgentSettings(BaseSettings)`
  - `class PermissionMode(str, Enum)`
  - `class AgentPreset(BaseModel)`
  - `ALL_PRESETS: dict[str, AgentPreset]`
  - `DEFAULT_PRESET_ID: str`
  - `def get_preset(preset_id: str) -> AgentPreset`
  - `def mutable_tool_names(mode: PermissionMode) -> set[str]`
  - `def interrupt_config_for_mode(mode: PermissionMode) -> dict[str, bool]`

- [ ] **Step 1: Write the failing backend policy tests**

```python
# agent/tests/test_config_and_presets.py
from app.presets import ALL_PRESETS, DEFAULT_PRESET_ID, get_preset


def test_default_preset_exists() -> None:
    assert DEFAULT_PRESET_ID in ALL_PRESETS


def test_all_model_permission_pairs_exist() -> None:
    expected = {
        "openai-read-only",
        "openai-balanced",
        "openai-full-access",
        "anthropic-read-only",
        "anthropic-balanced",
        "anthropic-full-access",
        "google-read-only",
        "google-balanced",
        "google-full-access",
    }
    assert set(ALL_PRESETS) == expected


def test_get_preset_returns_metadata() -> None:
    preset = get_preset("openai-balanced")
    assert preset.model == "openai:gpt-5-mini"
    assert preset.permission_mode == "balanced"
```

```python
# agent/tests/test_permissions.py
from app.permissions import PermissionMode, interrupt_config_for_mode, mutable_tool_names


def test_read_only_exposes_no_mutating_tools() -> None:
    assert mutable_tool_names(PermissionMode.READ_ONLY) == set()


def test_balanced_interrupts_mutating_tools() -> None:
    interrupt_map = interrupt_config_for_mode(PermissionMode.BALANCED)
    assert interrupt_map == {
        "replace_text_in_file": True,
        "write_text_file": True,
        "run_command": True,
    }


def test_full_access_has_no_interrupts() -> None:
    assert interrupt_config_for_mode(PermissionMode.FULL_ACCESS) == {}
```

- [ ] **Step 2: Run the backend policy tests to verify they fail**

Run: `uv run --project agent pytest agent/tests/test_config_and_presets.py agent/tests/test_permissions.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app'` or import failures for `app.presets`.

- [ ] **Step 3: Write the backend config and preset modules**

```toml
# agent/pyproject.toml
[project]
name = "deep-agent-666-agent"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "ag-ui-langgraph==0.0.42",
  "copilotkit==0.1.94",
  "deepagents==0.6.11",
  "fastapi==0.138.0",
  "langchain>=1.0.0,<2.0.0",
  "langgraph==1.2.6",
  "pydantic>=2.11.0,<3.0.0",
  "pydantic-settings==2.14.2",
  "pypdf>=5.8.0,<6.0.0",
  "python-docx>=1.1.0,<2.0.0",
  "uvicorn==0.49.0"
]

[project.optional-dependencies]
dev = [
  "httpx>=0.28.0,<1.0.0",
  "pytest>=8.4.0,<9.0.0",
  "ruff>=0.12.0,<1.0.0"
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

```python
# agent/app/config.py
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    workspace_root: Path = Field(alias="AGENT_WORKSPACE_ROOT")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    google_api_key: str | None = Field(default=None, alias="GOOGLE_API_KEY")


def load_settings() -> AgentSettings:
    settings = AgentSettings()
    settings.workspace_root.mkdir(parents=True, exist_ok=True)
    return settings
```

```python
# agent/app/permissions.py
from enum import Enum


class PermissionMode(str, Enum):
    READ_ONLY = "read-only"
    BALANCED = "balanced"
    FULL_ACCESS = "full-access"


def mutable_tool_names(mode: PermissionMode) -> set[str]:
    if mode == PermissionMode.READ_ONLY:
        return set()
    return {"replace_text_in_file", "write_text_file", "run_command"}


def interrupt_config_for_mode(mode: PermissionMode) -> dict[str, bool]:
    if mode == PermissionMode.BALANCED:
        return {
            "replace_text_in_file": True,
            "write_text_file": True,
            "run_command": True,
        }
    return {}
```

```python
# agent/app/presets.py
from pydantic import BaseModel

from app.permissions import PermissionMode


class AgentPreset(BaseModel):
    id: str
    label: str
    model: str
    permission_mode: PermissionMode


DEFAULT_PRESET_ID = "openai-balanced"


ALL_PRESETS: dict[str, AgentPreset] = {
    "openai-read-only": AgentPreset(
        id="openai-read-only",
        label="OpenAI / Read-only",
        model="openai:gpt-5-mini",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "openai-balanced": AgentPreset(
        id="openai-balanced",
        label="OpenAI / Balanced",
        model="openai:gpt-5-mini",
        permission_mode=PermissionMode.BALANCED,
    ),
    "openai-full-access": AgentPreset(
        id="openai-full-access",
        label="OpenAI / Full access",
        model="openai:gpt-5-mini",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
    "anthropic-read-only": AgentPreset(
        id="anthropic-read-only",
        label="Anthropic / Read-only",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "anthropic-balanced": AgentPreset(
        id="anthropic-balanced",
        label="Anthropic / Balanced",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.BALANCED,
    ),
    "anthropic-full-access": AgentPreset(
        id="anthropic-full-access",
        label="Anthropic / Full access",
        model="anthropic:claude-sonnet-4.5",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
    "google-read-only": AgentPreset(
        id="google-read-only",
        label="Google / Read-only",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.READ_ONLY,
    ),
    "google-balanced": AgentPreset(
        id="google-balanced",
        label="Google / Balanced",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.BALANCED,
    ),
    "google-full-access": AgentPreset(
        id="google-full-access",
        label="Google / Full access",
        model="google:gemini-2.5-flash",
        permission_mode=PermissionMode.FULL_ACCESS,
    ),
}


def get_preset(preset_id: str) -> AgentPreset:
    return ALL_PRESETS[preset_id]
```

```python
# agent/app/__init__.py
__all__ = [
    "config",
    "permissions",
    "presets",
]
```

- [ ] **Step 4: Run the backend policy tests to verify they pass**

Run: `uv run --project agent pytest agent/tests/test_config_and_presets.py agent/tests/test_permissions.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/pyproject.toml agent/app/__init__.py agent/app/config.py agent/app/permissions.py agent/app/presets.py agent/tests/test_config_and_presets.py agent/tests/test_permissions.py
git commit -m "feat: add backend presets and permission policy"
```

### Task 3: Backend Tools and Deep Agents FastAPI Service

**Files:**
- Create: `agent/app/tools/__init__.py`
- Create: `agent/app/tools/workspace.py`
- Create: `agent/app/tools/documents.py`
- Create: `agent/app/agent_factory.py`
- Create: `agent/app/main.py`
- Test: `agent/tests/test_workspace_tools.py`
- Test: `agent/tests/test_documents.py`
- Test: `agent/tests/test_agent_factory.py`

**Interfaces:**
- Consumes:
  - `AgentSettings.workspace_root`
  - `AgentPreset`
  - `PermissionMode`
- Produces:
  - `def list_workspace(relative_path: str = ".") -> str`
  - `def search_workspace(query: str, glob: str = "*") -> str`
  - `def read_text_file(path: str) -> str`
  - `def write_text_file(path: str, content: str) -> str`
  - `def replace_text_in_file(path: str, old_text: str, new_text: str) -> str`
  - `def run_command(command: str, cwd: str = ".") -> dict[str, str | int]`
  - `def read_document(path: str) -> str`
  - `def build_graph(preset: AgentPreset, settings: AgentSettings) -> object`
  - `app: FastAPI`

- [ ] **Step 1: Write the failing tool and service tests**

```python
# agent/tests/test_workspace_tools.py
from pathlib import Path

from app.tools.workspace import replace_text_in_file, resolve_workspace_path, run_command


def test_resolve_workspace_path_blocks_escape(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    try:
        resolve_workspace_path(workspace, "../outside.txt")
    except ValueError as error:
        assert "outside the workspace root" in str(error)
    else:
        raise AssertionError("expected ValueError for path escape")


def test_replace_text_in_file_edits_in_place(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    file_path = workspace / "note.txt"
    file_path.write_text("hello world", encoding="utf-8")
    result = replace_text_in_file(workspace, "note.txt", "world", "team")
    assert "updated" in result
    assert file_path.read_text(encoding="utf-8") == "hello team"


def test_run_command_returns_stdout(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    result = run_command(workspace, "$PSVersionTable.PSVersion.ToString()", ".")
    assert result["exit_code"] == 0
    assert result["stdout"]
```

```python
# agent/tests/test_documents.py
from pathlib import Path

from app.tools.documents import read_document


def test_read_document_reads_plain_text(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    file_path = workspace / "memo.md"
    file_path.write_text("# Heading\n\nParagraph", encoding="utf-8")
    content = read_document(workspace, "memo.md")
    assert "Heading" in content
    assert "Paragraph" in content
```

```python
# agent/tests/test_agent_factory.py
from app.agent_factory import build_graph_map
from app.config import AgentSettings
from app.presets import ALL_PRESETS


def test_build_graph_map_covers_every_preset(tmp_path) -> None:
    settings = AgentSettings.model_validate(
        {
            "AGENT_WORKSPACE_ROOT": str(tmp_path / "workspace"),
            "OPENAI_API_KEY": "test-key",
        }
    )
    graph_map = build_graph_map(settings)
    assert set(graph_map) == set(ALL_PRESETS)
```

- [ ] **Step 2: Run the tool and service tests to verify they fail**

Run: `uv run --project agent pytest agent/tests/test_workspace_tools.py agent/tests/test_documents.py agent/tests/test_agent_factory.py -v`

Expected: FAIL with missing modules or missing functions such as `resolve_workspace_path`.

- [ ] **Step 3: Write the backend tools, graph factory, and FastAPI app**

```python
# agent/app/tools/workspace.py
from __future__ import annotations

from pathlib import Path
import subprocess


def resolve_workspace_path(workspace_root: Path, relative_path: str) -> Path:
    candidate = (workspace_root / relative_path).resolve()
    workspace_root = workspace_root.resolve()
    if workspace_root not in candidate.parents and candidate != workspace_root:
        raise ValueError(f"path is outside the workspace root: {relative_path}")
    return candidate


def list_workspace(workspace_root: Path, relative_path: str = ".") -> str:
    target = resolve_workspace_path(workspace_root, relative_path)
    lines = []
    for entry in sorted(target.iterdir(), key=lambda item: (item.is_file(), item.name.lower())):
        suffix = "/" if entry.is_dir() else ""
        lines.append(f"{entry.name}{suffix}")
    return "\n".join(lines)


def search_workspace(workspace_root: Path, query: str, glob: str = "*") -> str:
    matches: list[str] = []
    for path in workspace_root.rglob(glob):
        if path.is_file():
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for line_number, line in enumerate(text.splitlines(), start=1):
                if query.lower() in line.lower():
                    matches.append(f"{path.relative_to(workspace_root)}:{line_number}:{line.strip()}")
    return "\n".join(matches[:200]) or "No matches found."


def read_text_file(workspace_root: Path, path: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    return target.read_text(encoding="utf-8")


def write_text_file(workspace_root: Path, path: str, content: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"wrote {target.relative_to(workspace_root)}"


def replace_text_in_file(workspace_root: Path, path: str, old_text: str, new_text: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    content = target.read_text(encoding="utf-8")
    if old_text not in content:
        raise ValueError("old_text not found in file")
    target.write_text(content.replace(old_text, new_text, 1), encoding="utf-8")
    return f"updated {target.relative_to(workspace_root)}"


def run_command(workspace_root: Path, command: str, cwd: str = ".") -> dict[str, str | int]:
    target_cwd = resolve_workspace_path(workspace_root, cwd)
    completed = subprocess.run(
        ["powershell", "-NoLogo", "-NoProfile", "-Command", command],
        cwd=target_cwd,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    return {
        "cwd": str(target_cwd),
        "stdout": completed.stdout[-8000:],
        "stderr": completed.stderr[-8000:],
        "exit_code": completed.returncode,
    }
```

```python
# agent/app/tools/documents.py
from __future__ import annotations

from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.tools.workspace import resolve_workspace_path


def read_document(workspace_root: Path, path: str) -> str:
    target = resolve_workspace_path(workspace_root, path)
    suffix = target.suffix.lower()
    if suffix in {".txt", ".md", ".py", ".json", ".yaml", ".yml"}:
        return target.read_text(encoding="utf-8")
    if suffix == ".docx":
        document = Document(target)
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
    if suffix == ".pdf":
        reader = PdfReader(str(target))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    raise ValueError(f"unsupported document type: {suffix}")
```

> **2026-06-25 更新：** `LangGraphAGUIAgent` 包装和 `add_langgraph_fastapi_endpoint` 注册已迁移到 `CopilotKitRemoteEndpoint` + `add_fastapi_endpoint` 模式。agent_factory.py 改为返回原始 compiled graph，main.py 统一通过 `CopilotKitRemoteEndpoint` 注册所有 agent。详见 `docs/superpowers/plans/2026-06-25-sdk-upgrade-plan.md`。

```python
# agent/app/agent_factory.py
from __future__ import annotations

from pathlib import Path

from deepagents import create_deep_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from app.config import AgentSettings
from app.permissions import PermissionMode, interrupt_config_for_mode, mutable_tool_names
from app.presets import ALL_PRESETS, AgentPreset
from app.tools.documents import read_document
from app.tools.workspace import (
    list_workspace,
    read_text_file,
    replace_text_in_file,
    run_command,
    search_workspace,
    write_text_file,
)


SYSTEM_PROMPT = """You are the primary local work agent.
Use the workspace tools to inspect, edit, and summarize files.
When a tool call is interrupted for approval, wait for the human decision and continue.
Prefer concise, execution-focused responses."""


def _toolset_for_preset(workspace_root: Path, permission_mode: PermissionMode):
    @tool
    def list_workspace_tool(relative_path: str = ".") -> str:
        """List files and directories under the workspace root."""
        return list_workspace(workspace_root, relative_path)

    @tool
    def search_workspace_tool(query: str, glob: str = "*") -> str:
        """Search UTF-8 text files in the workspace for a query string."""
        return search_workspace(workspace_root, query, glob)

    @tool
    def read_text_file_tool(path: str) -> str:
        """Read a UTF-8 text file from the workspace."""
        return read_text_file(workspace_root, path)

    @tool
    def read_document_tool(path: str) -> str:
        """Read a local text, markdown, DOCX, or PDF document from the workspace."""
        return read_document(workspace_root, path)

    toolset = [
        list_workspace_tool,
        search_workspace_tool,
        read_text_file_tool,
        read_document_tool,
    ]

    if "write_text_file" in mutable_tool_names(permission_mode):
        @tool
        def write_text_file_tool(path: str, content: str) -> str:
            """Write a UTF-8 text file inside the workspace."""
            return write_text_file(workspace_root, path, content)

        toolset.append(write_text_file_tool)

    if "replace_text_in_file" in mutable_tool_names(permission_mode):
        @tool
        def replace_text_in_file_tool(path: str, old_text: str, new_text: str) -> str:
            """Replace one matching string in a UTF-8 text file."""
            return replace_text_in_file(workspace_root, path, old_text, new_text)

        toolset.append(replace_text_in_file_tool)

    if "run_command" in mutable_tool_names(permission_mode):
        @tool
        def run_command_tool(command: str, cwd: str = ".") -> dict[str, str | int]:
            """Execute a PowerShell command rooted to the workspace."""
            return run_command(workspace_root, command, cwd)

        toolset.append(run_command_tool)

    return toolset


def build_graph(preset: AgentPreset, settings: AgentSettings):
    return create_deep_agent(
        model=preset.model,
        tools=_toolset_for_preset(settings.workspace_root, preset.permission_mode),
        system_prompt=SYSTEM_PROMPT,
        interrupt_on=interrupt_config_for_mode(preset.permission_mode),
        checkpointer=MemorySaver(),
        name=preset.id,
    )


def build_graph_map(settings: AgentSettings) -> dict[str, object]:
    return {preset.id: build_graph(preset, settings) for preset in ALL_PRESETS.values()}


def build_langgraph_agents(settings: AgentSettings) -> dict[str, LangGraphAGUIAgent]:
    graph_map = build_graph_map(settings)
    return {
        preset_id: LangGraphAGUIAgent(
            name=preset_id,
            description=ALL_PRESETS[preset_id].label,
            graph=graph_map[preset_id],
        )
        for preset_id in graph_map
    }
```

```python
# agent/app/main.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from app.agent_factory import build_langgraph_agents
from app.config import load_settings
from app.presets import ALL_PRESETS, DEFAULT_PRESET_ID


settings = load_settings()
app = FastAPI(title="deep-agent-666-agent")
agents = build_langgraph_agents(settings)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "preset_count": len(agents)})


@app.get("/presets")
async def presets() -> JSONResponse:
    payload = {
        "defaultPresetId": DEFAULT_PRESET_ID,
        "presets": [preset.model_dump() for preset in ALL_PRESETS.values()],
    }
    return JSONResponse(payload)


for preset_id, agent in agents.items():
    add_langgraph_fastapi_endpoint(app=app, agent=agent, path=f"/{preset_id}")
```

```python
# agent/app/tools/__init__.py
from app.tools.documents import read_document
from app.tools.workspace import (
    list_workspace,
    read_text_file,
    replace_text_in_file,
    run_command,
    search_workspace,
    write_text_file,
)

__all__ = [
    "list_workspace",
    "search_workspace",
    "read_text_file",
    "write_text_file",
    "replace_text_in_file",
    "run_command",
    "read_document",
]
```

- [ ] **Step 4: Run the backend tool and service tests to verify they pass**

Run: `uv run --project agent pytest agent/tests/test_workspace_tools.py agent/tests/test_documents.py agent/tests/test_agent_factory.py -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/app/tools/__init__.py agent/app/tools/workspace.py agent/app/tools/documents.py agent/app/agent_factory.py agent/app/main.py agent/tests/test_workspace_tools.py agent/tests/test_documents.py agent/tests/test_agent_factory.py
git commit -m "feat: add deep agents backend service"
```

### Task 4: Next.js Runtime Bridge and App Shell

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/vitest.config.ts`
- Create: `web/src/app/globals.css`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/providers.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/api/copilotkit/[...slug]/route.ts`
- Create: `web/src/lib/agent-presets.ts`
- Create: `web/src/lib/copilot-runtime.ts`
- Test: `web/src/lib/__tests__/agent-presets.test.ts`
- Test: `web/src/lib/__tests__/copilot-runtime.test.ts`

**Interfaces:**
- Consumes:
  - `AGENT_BASE_URL`
  - `COPILOTKIT_THREADS_DB_PATH`
  - `NEXT_PUBLIC_DEFAULT_AGENT_PRESET`
  - Python preset IDs from `agent/app/presets.py`
- Produces:
  - `type AgentPresetId`
  - `const ALL_AGENT_PRESETS`
  - `function resolvePresetId(provider: ProviderKey, permission: PermissionMode): AgentPresetId`
  - `function buildRemoteAgentUrl(baseUrl: string, presetId: AgentPresetId): string`
  - `function createRuntime()`
  - `GET`, `POST`, `OPTIONS` route handlers at `/api/copilotkit/[...slug]`

- [ ] **Step 1: Write the failing runtime helper tests**

```typescript
// web/src/lib/__tests__/agent-presets.test.ts
import { describe, expect, it } from "vitest";
import { ALL_AGENT_PRESETS, resolvePresetId } from "../agent-presets";

describe("agent presets", () => {
  it("resolves model and permission pairs to preset ids", () => {
    expect(resolvePresetId("openai", "balanced")).toBe("openai-balanced");
    expect(resolvePresetId("anthropic", "read-only")).toBe("anthropic-read-only");
  });

  it("exposes every preset id expected by the backend", () => {
    expect(ALL_AGENT_PRESETS.map((preset) => preset.id)).toEqual([
      "openai-read-only",
      "openai-balanced",
      "openai-full-access",
      "anthropic-read-only",
      "anthropic-balanced",
      "anthropic-full-access",
      "google-read-only",
      "google-balanced",
      "google-full-access",
    ]);
  });
});
```

```typescript
// web/src/lib/__tests__/copilot-runtime.test.ts
import { describe, expect, it } from "vitest";
import { buildRemoteAgentUrl } from "../copilot-runtime";

describe("copilot runtime helpers", () => {
  it("builds preset-specific backend urls", () => {
    expect(buildRemoteAgentUrl("http://127.0.0.1:8123", "openai-balanced")).toBe(
      "http://127.0.0.1:8123/openai-balanced",
    );
  });
});
```

- [ ] **Step 2: Run the runtime helper tests to verify they fail**

Run: `npm --prefix web run test -- --run src/lib/__tests__/agent-presets.test.ts src/lib/__tests__/copilot-runtime.test.ts`

Expected: FAIL with `Cannot find module '../agent-presets'` or missing `web/package.json`.

- [ ] **Step 3: Write the Next.js app shell and CopilotKit runtime**

```json
{
  "name": "deep-agent-666-web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@copilotkit/react-core": "^1.61.1",
    "@copilotkit/runtime": "^1.61.1",
    "@copilotkit/sqlite-runner": "^1.61.1",
    "better-sqlite3": "^12.11.1",
    "next": "^16.2.9",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
}
```

```typescript
// web/src/lib/agent-presets.ts
export type ProviderKey = "openai" | "anthropic" | "google";
export type PermissionMode = "read-only" | "balanced" | "full-access";
export type AgentPresetId =
  | "openai-read-only"
  | "openai-balanced"
  | "openai-full-access"
  | "anthropic-read-only"
  | "anthropic-balanced"
  | "anthropic-full-access"
  | "google-read-only"
  | "google-balanced"
  | "google-full-access";

export const ALL_AGENT_PRESETS = [
  { id: "openai-read-only", provider: "openai", permissionMode: "read-only", label: "OpenAI / Read-only" },
  { id: "openai-balanced", provider: "openai", permissionMode: "balanced", label: "OpenAI / Balanced" },
  { id: "openai-full-access", provider: "openai", permissionMode: "full-access", label: "OpenAI / Full access" },
  { id: "anthropic-read-only", provider: "anthropic", permissionMode: "read-only", label: "Anthropic / Read-only" },
  { id: "anthropic-balanced", provider: "anthropic", permissionMode: "balanced", label: "Anthropic / Balanced" },
  { id: "anthropic-full-access", provider: "anthropic", permissionMode: "full-access", label: "Anthropic / Full access" },
  { id: "google-read-only", provider: "google", permissionMode: "read-only", label: "Google / Read-only" },
  { id: "google-balanced", provider: "google", permissionMode: "balanced", label: "Google / Balanced" },
  { id: "google-full-access", provider: "google", permissionMode: "full-access", label: "Google / Full access" },
] as const;

export function resolvePresetId(provider: ProviderKey, permissionMode: PermissionMode): AgentPresetId {
  return `${provider}-${permissionMode}` as AgentPresetId;
}
```

```typescript
// web/src/lib/copilot-runtime.ts
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { SqliteAgentRunner } from "@copilotkit/sqlite-runner";

import { ALL_AGENT_PRESETS, type AgentPresetId } from "./agent-presets";

const AGENT_BASE_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";
const THREADS_DB_PATH = process.env.COPILOTKIT_THREADS_DB_PATH ?? "./data/threads.db";

export function buildRemoteAgentUrl(baseUrl: string, presetId: AgentPresetId): string {
  return `${baseUrl.replace(/\/$/, "")}/${presetId}`;
}

export function createRuntime() {
  const agents = Object.fromEntries(
    ALL_AGENT_PRESETS.map((preset) => [
      preset.id,
      new LangGraphHttpAgent({
        url: buildRemoteAgentUrl(AGENT_BASE_URL, preset.id),
      }),
    ]),
  );

  return new CopilotRuntime({
    agents,
    runner: new SqliteAgentRunner({ dbPath: THREADS_DB_PATH }),
  });
}

export function createHandler() {
  return createCopilotRuntimeHandler({
    runtime: createRuntime(),
    basePath: "/api/copilotkit",
    cors: true,
  });
}
```

```typescript
// web/src/app/api/copilotkit/[...slug]/route.ts
import { createHandler } from "@/lib/copilot-runtime";

const handler = createHandler();

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
```

```tsx
// web/src/app/providers.tsx
"use client";

import "@copilotkit/react-core/v2/styles.css";
import { CopilotKit } from "@copilotkit/react-core/v2";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      showDevConsole
      onError={({ code, error, context }) => {
        console.error("[copilotkit]", code, error, context);
      }}
    >
      {children}
    </CopilotKit>
  );
}
```

```tsx
// web/src/app/layout.tsx
import "./globals.css";
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// web/src/app/page.tsx
import { AgentWorkbench } from "@/components/agent-workbench";

export default function Page() {
  return <AgentWorkbench />;
}
```

```css
/* web/src/app/globals.css */
:root {
  color-scheme: light;
  --bg: #f4efe7;
  --panel: rgba(255, 255, 255, 0.92);
  --ink: #181512;
  --muted: #6c655d;
  --line: rgba(24, 21, 18, 0.12);
  --accent: #2d6a4f;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(45, 106, 79, 0.14), transparent 32%),
    linear-gradient(180deg, #f8f4ee 0%, var(--bg) 100%);
  color: var(--ink);
  font-family: "Segoe UI", "PingFang SC", sans-serif;
}
```

```typescript
// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

```jsonc
// web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```typescript
// web/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Run the runtime helper tests to verify they pass**

Run: `npm --prefix web run test -- --run src/lib/__tests__/agent-presets.test.ts src/lib/__tests__/copilot-runtime.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/tsconfig.json web/next.config.ts web/vitest.config.ts web/src/app/globals.css web/src/app/layout.tsx web/src/app/providers.tsx web/src/app/page.tsx web/src/app/api/copilotkit/[...slug]/route.ts web/src/lib/agent-presets.ts web/src/lib/copilot-runtime.ts web/src/lib/__tests__/agent-presets.test.ts web/src/lib/__tests__/copilot-runtime.test.ts
git commit -m "feat: add nextjs copilot runtime shell"
```

### Task 5: Chat Workbench, Local Threads, and Approval UI

**Files:**
- Create: `web/src/lib/thread-registry.ts`
- Create: `web/src/components/thread-sidebar.tsx`
- Create: `web/src/components/settings-panel.tsx`
- Create: `web/src/components/interrupt-approval.tsx`
- Create: `web/src/components/tool-call-renderers.tsx`
- Create: `web/src/components/agent-workbench.tsx`
- Test: `web/src/lib/__tests__/thread-registry.test.ts`
- Test: `web/src/components/__tests__/agent-workbench.test.tsx`

**Interfaces:**
- Consumes:
  - `AgentPresetId`
  - `resolvePresetId(provider, permissionMode)`
  - `CopilotChat` with explicit `agentId` and `threadId`
- Produces:
  - `type LocalThread = { id: string; title: string; presetId: AgentPresetId; updatedAt: number }`
  - `function loadThreads(storage?: Storage): LocalThread[]`
  - `function saveThreads(threads: LocalThread[], storage?: Storage): void`
  - `function createLocalThread(presetId: AgentPresetId): LocalThread`
  - `AgentWorkbench` chat-first layout
  - `InterruptApproval` using `useInterrupt`

- [ ] **Step 1: Write the failing local-thread and workbench tests**

```typescript
// web/src/lib/__tests__/thread-registry.test.ts
import { describe, expect, it } from "vitest";
import { createLocalThread, loadThreads, saveThreads } from "../thread-registry";

describe("thread registry", () => {
  it("persists preset-aware threads", () => {
    const storage = window.localStorage;
    storage.clear();
    const thread = createLocalThread("openai-balanced");
    saveThreads([thread], storage);
    expect(loadThreads(storage)).toEqual([thread]);
  });
});
```

```tsx
// web/src/components/__tests__/agent-workbench.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentWorkbench } from "../agent-workbench";

describe("AgentWorkbench", () => {
  it("renders the shell labels", () => {
    render(<AgentWorkbench />);
    expect(screen.getByText("Threads")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the local-thread and workbench tests to verify they fail**

Run: `npm --prefix web run test -- --run src/lib/__tests__/thread-registry.test.ts src/components/__tests__/agent-workbench.test.tsx`

Expected: FAIL with missing module errors for `thread-registry` or `agent-workbench`.

- [ ] **Step 3: Write the chat shell, local thread store, and approval UI**

```typescript
// web/src/lib/thread-registry.ts
import { randomUUID } from "@copilotkit/shared";
import type { AgentPresetId } from "./agent-presets";

export type LocalThread = {
  id: string;
  title: string;
  presetId: AgentPresetId;
  updatedAt: number;
};

const STORAGE_KEY = "deep-agent-666.threads";

export function loadThreads(storage: Storage = window.localStorage): LocalThread[] {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as LocalThread[]) : [];
}

export function saveThreads(threads: LocalThread[], storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function createLocalThread(presetId: AgentPresetId): LocalThread {
  return {
    id: randomUUID(),
    title: "New thread",
    presetId,
    updatedAt: Date.now(),
  };
}
```

```tsx
// web/src/components/thread-sidebar.tsx
"use client";

import type { LocalThread } from "@/lib/thread-registry";

export function ThreadSidebar(props: {
  threads: LocalThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
}) {
  return (
    <aside style={{ padding: 16, borderRight: "1px solid var(--line)", minWidth: 240 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Threads</h2>
        <button onClick={props.onCreateThread}>New</button>
      </div>
      {props.threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => props.onSelectThread(thread.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            marginBottom: 8,
            padding: 10,
            borderRadius: 12,
            border: thread.id === props.activeThreadId ? "1px solid var(--accent)" : "1px solid var(--line)",
            background: "var(--panel)",
          }}
        >
          <strong>{thread.title}</strong>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{thread.presetId}</div>
        </button>
      ))}
    </aside>
  );
}
```

```tsx
// web/src/components/settings-panel.tsx
"use client";

import type { PermissionMode, ProviderKey } from "@/lib/agent-presets";

export function SettingsPanel(props: {
  provider: ProviderKey;
  permissionMode: PermissionMode;
  onProviderChange: (provider: ProviderKey) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
      <label>
        Model
        <select value={props.provider} onChange={(event) => props.onProviderChange(event.target.value as ProviderKey)}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google</option>
        </select>
      </label>
      <label>
        Permission
        <select
          value={props.permissionMode}
          onChange={(event) => props.onPermissionModeChange(event.target.value as PermissionMode)}
        >
          <option value="read-only">Read-only</option>
          <option value="balanced">Balanced</option>
          <option value="full-access">Full access</option>
        </select>
      </label>
    </div>
  );
}
```

```tsx
// web/src/components/interrupt-approval.tsx
"use client";

import { useInterrupt } from "@copilotkit/react-core/v2";

function renderInterruptBody(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function InterruptApproval() {
  useInterrupt({
    enabled: (event) => event.name === "on_interrupt",
    render: ({ event, resolve }) => (
      <div
        style={{
          border: "1px solid var(--accent)",
          borderRadius: 16,
          padding: 16,
          background: "#f7fff8",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Approval required</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{renderInterruptBody(event.value)}</pre>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => resolve({ decisions: [{ type: "approve" }] })}>Approve</button>
          <button
            onClick={() =>
              resolve({
                decisions: [
                  {
                    type: "reject",
                    message: "User rejected this action. Do not retry without asking again.",
                  },
                ],
              })
            }
          >
            Reject
          </button>
        </div>
      </div>
    ),
  });

  return null;
}
```

```tsx
// web/src/components/tool-call-renderers.tsx
"use client";

import { useDefaultRenderTool, useRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

export function ToolCallRenderers() {
  useDefaultRenderTool();

  useRenderTool(
    {
      name: "run_command_tool",
      parameters: z.object({ command: z.string(), cwd: z.string().optional() }),
      render: ({ status, parameters, result }) => (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
          <strong>PowerShell</strong>
          <div>{parameters.command}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{status}</div>
          {status === "complete" ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
        </div>
      ),
    },
    [],
  );

  useRenderTool(
    {
      name: "read_document_tool",
      parameters: z.object({ path: z.string() }),
      render: ({ status, parameters }) => (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
          <strong>Document</strong>
          <div>{parameters.path}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{status}</div>
        </div>
      ),
    },
    [],
  );

  return null;
}
```

```tsx
// web/src/components/agent-workbench.tsx
"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useState } from "react";

import type { PermissionMode, ProviderKey } from "@/lib/agent-presets";
import { resolvePresetId } from "@/lib/agent-presets";
import { createLocalThread, loadThreads, saveThreads } from "@/lib/thread-registry";
import { InterruptApproval } from "./interrupt-approval";
import { SettingsPanel } from "./settings-panel";
import { ThreadSidebar } from "./thread-sidebar";
import { ToolCallRenderers } from "./tool-call-renderers";

export function AgentWorkbench() {
  const [provider, setProvider] = useState<ProviderKey>("openai");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("balanced");
  const initialPresetId = resolvePresetId(provider, permissionMode);
  const [threads, setThreads] = useState(() => {
    if (typeof window === "undefined") return [createLocalThread(initialPresetId)];
    const existing = loadThreads();
    return existing.length ? existing : [createLocalThread(initialPresetId)];
  });
  const [activeThreadId, setActiveThreadId] = useState(() => threads[0].id);

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const currentPresetId = resolvePresetId(provider, permissionMode);

  useEffect(() => {
    if (!activeThread) return;
    if (activeThread.presetId === currentPresetId) return;
    const nextThread = createLocalThread(currentPresetId);
    setThreads((previous) => [nextThread, ...previous]);
    setActiveThreadId(nextThread.id);
  }, [activeThread, currentPresetId]);

  return (
    <main style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThread.id}
        onSelectThread={setActiveThreadId}
        onCreateThread={() => {
          const nextThread = createLocalThread(currentPresetId);
          setThreads((previous) => [nextThread, ...previous]);
          setActiveThreadId(nextThread.id);
        }}
      />
      <section style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Assistant</h1>
        <SettingsPanel
          provider={provider}
          permissionMode={permissionMode}
          onProviderChange={setProvider}
          onPermissionModeChange={setPermissionMode}
        />
        <ToolCallRenderers />
        <InterruptApproval />
        <div style={{ height: "calc(100vh - 180px)", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden" }}>
          <CopilotChat agentId={activeThread.presetId} threadId={activeThread.id} />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run the local-thread and workbench tests to verify they pass**

Run: `npm --prefix web run test -- --run src/lib/__tests__/thread-registry.test.ts src/components/__tests__/agent-workbench.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/thread-registry.ts web/src/components/thread-sidebar.tsx web/src/components/settings-panel.tsx web/src/components/interrupt-approval.tsx web/src/components/tool-call-renderers.tsx web/src/components/agent-workbench.tsx web/src/lib/__tests__/thread-registry.test.ts web/src/components/__tests__/agent-workbench.test.tsx
git commit -m "feat: add chat workbench and approval ui"
```

### Task 6: Browser Smoke Tests and Runbook

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/chat-smoke.spec.ts`
- Create: `README.md`

**Interfaces:**
- Consumes:
  - Running backend at `http://127.0.0.1:8123`
  - Running frontend at `http://127.0.0.1:3000`
- Produces:
  - `npm --prefix web run e2e`
  - User-facing Windows runbook in `README.md`

- [ ] **Step 1: Write the failing browser smoke test**

```typescript
// web/tests/e2e/chat-smoke.spec.ts
import { test, expect } from "@playwright/test";

test("renders the local agent shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Assistant")).toBeVisible();
  await expect(page.getByText("Threads")).toBeVisible();
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
});
```

- [ ] **Step 2: Run the browser smoke test to verify it fails**

Run: `npm --prefix web run e2e -- --grep "renders the local agent shell"`

Expected: FAIL because `playwright.config.ts` does not exist yet or no dev server is configured.

- [ ] **Step 3: Write the Playwright config and README runbook**

```typescript
// web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    cwd: ".",
    reuseExistingServer: true,
    url: "http://127.0.0.1:3000",
  },
});
```

````markdown
# deep-agent-666

Local-first single-assistant MVP built on Deep Agents, LangGraph, and CopilotKit.

## Windows setup

1. Copy `.env.example` to `.env`.
2. Fill in at least one provider key:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_API_KEY`
3. Set `AGENT_WORKSPACE_ROOT` to the workspace the agent is allowed to inspect.

## Install

### Backend

```powershell
uv sync --project agent --extra dev
```

### Frontend

```powershell
cd web
npm install
cd ..
```

## Run

### Backend

```powershell
uv run --project agent uvicorn app.main:app --host 127.0.0.1 --port 8123 --reload
```

### Frontend

```powershell
cd web
npm run dev
```

Open `http://127.0.0.1:3000`.

## Test

### Python

```powershell
uv run --project agent pytest
```

### TypeScript

```powershell
cd web
npm run test
```

### Browser smoke

```powershell
cd web
npm run e2e
```
````

- [ ] **Step 4: Run the verification commands**

Run: `python -m pytest tests/smoke/test_repo_layout.py -v && uv run --project agent pytest -v && npm --prefix web run test && npm --prefix web run typecheck`

Expected: PASS

Run: `npm --prefix web run e2e -- --grep "renders the local agent shell"`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/playwright.config.ts web/tests/e2e/chat-smoke.spec.ts README.md
git commit -m "test: add smoke coverage and runbook"
```

## Self-Review

### Spec coverage

- Local-first requirement is implemented by:
  - workspace-scoped Python tools
  - local `SqliteAgentRunner`
  - local browser thread registry
- Web-first plus future Windows desktop compatibility is implemented by:
  - a standalone Next.js shell
  - a separate local Python service boundary
- Single-agent product perspective is implemented by:
  - one `CopilotChat`
  - hidden multi-preset runtime agents selected by UI settings
- Multi-model support is implemented by:
  - nine preset agents across OpenAI, Anthropic, and Google
- Switchable permission modes are implemented by:
  - preset-specific permission modes
  - interrupt-enabled balanced mode
  - read-only and full-access variants
- Code, terminal, file, and office-document workflows are implemented by:
  - workspace list/search/read/edit tools
  - PowerShell command tool
  - DOCX/PDF document reader
- Pause and resume thread support is implemented by:
  - explicit `threadId`
  - `CopilotChat threadId`
  - `SqliteAgentRunner`

No spec gaps remain for the V1 foundation.

### Placeholder scan

- No `TODO`, `TBD`, `implement later`, or `fill in details` placeholders remain.
- Every task includes exact file paths, commands, and code content.

### Type consistency

- Backend preset IDs:
  - `openai-read-only`
  - `openai-balanced`
  - `openai-full-access`
  - `anthropic-read-only`
  - `anthropic-balanced`
  - `anthropic-full-access`
  - `google-read-only`
  - `google-balanced`
  - `google-full-access`
- Frontend `AgentPresetId` matches the backend preset IDs exactly.
- Permission mode values are consistent across Python and TypeScript:
  - `read-only`
  - `balanced`
  - `full-access`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-24-deepagents-copilotkit-v1-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
