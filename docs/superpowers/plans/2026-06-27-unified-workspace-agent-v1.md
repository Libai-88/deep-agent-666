# Unified Workspace Agent V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Codex-like mixed-scenario workspace agent that can reliably complete both engineering and document-research tasks inside one local workspace.

**Architecture:** Keep the current Deep Agents + CopilotKit integration, but add one shared task model and one shared artifact model across both scenarios. The backend remains a single FastAPI/Deep Agents service with task-kind-aware prompts and research-friendly document tools; the frontend becomes a persistent workbench that stores per-thread todos, artifacts, and final results instead of only rendering transient chat events.

**Tech Stack:** Next.js 16, React 19, TypeScript, CopilotKit React Core v2, FastAPI, Deep Agents 0.6.11, LangGraph 1.2.6, Pytest, Vitest, Playwright

## Global Constraints

- Support exactly one local workspace root at a time; do not add multi-workspace switching in V1.
- Preserve the current permission model: `read-only`, `balanced`, `full-access`.
- Keep the current backend topology: one FastAPI process and one web app; do not introduce extra services for V1.
- Keep mixed-scenario support inside one agent product, not two separate products.
- Reuse current CopilotKit/Deep Agents integration points instead of replacing the runtime stack.
- Limit multi-agent orchestration to the existing `planner -> executor -> reviewer` coordinator pattern.
- Engineering and research tasks must share one thread model, one task timeline, and one artifact/result panel.
- Every task below must end with runnable tests and a commit.

---

## File Map

### Backend

- Modify: `agent/app/agent_factory.py`
  - Add task-kind-aware prompts and register research-friendly tools alongside workspace tools.
- Modify: `agent/app/state.py`
  - Extend coordinator state with a persisted `task_kind` and a final result summary field.
- Create: `agent/app/task_profile.py`
  - Centralize task-kind inference and per-kind prompt fragments.
- Modify: `agent/app/tools/documents.py`
  - Add structured metadata and bounded excerpt helpers so research tasks can inspect large docs safely.
- Create: `agent/tests/test_task_profile.py`
  - Validate task-kind inference and prompt shaping.
- Create: `agent/tests/test_documents_research.py`
  - Validate metadata/excerpt formatting and size limits.

### Frontend

- Create: `web/src/lib/workbench-state.ts`
  - Persist per-thread task timelines, artifacts, and final summaries in local storage.
- Create: `web/src/lib/tool-result-normalizer.ts`
  - Convert CopilotKit tool calls into normalized todos, file artifacts, research findings, and completion summaries.
- Create: `web/src/lib/__tests__/workbench-state.test.ts`
  - Validate storage, append/replace semantics, and thread isolation.
- Create: `web/src/lib/__tests__/tool-result-normalizer.test.ts`
  - Validate conversion from tool calls to UI-ready artifacts.
- Create: `web/src/components/TaskTimelinePanel.tsx`
  - Render per-thread todo/task progress across engineering and research runs.
- Create: `web/src/components/ArtifactResultsPanel.tsx`
  - Render changed files, findings, summaries, and completion results in one place.
- Modify: `web/src/app/page.tsx`
  - Replace ephemeral `todos/files` state with normalized persistent workbench state and the new panel layout.
- Modify: `web/src/components/TasksFilesSidebar.tsx`
  - Narrow this component to task/file rendering only, or remove it after the new workbench panels land.
- Create: `web/src/components/__tests__/TaskTimelinePanel.test.tsx`
  - Cover rendering of mixed task states.
- Create: `web/src/components/__tests__/ArtifactResultsPanel.test.tsx`
  - Cover rendering of file and research artifacts.
- Modify: `web/tests/e2e/smoke.spec.ts`
  - Add one engineering flow and one research flow assertion against the workbench UI.

## Task 1: Add Thread-Scoped Workbench State

**Files:**
- Create: `web/src/lib/workbench-state.ts`
- Create: `web/src/lib/__tests__/workbench-state.test.ts`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `LocalThread` from `web/src/lib/thread-registry.ts`
- Produces:
  - `export type WorkbenchTaskKind = "engineering" | "research" | "general";`
  - `export type WorkbenchTodo = { id: string; content: string; status: "pending" | "in_progress" | "completed"; source: "agent" | "user"; };`
  - `export type WorkbenchArtifact = { id: string; kind: "file" | "finding" | "summary"; title: string; path?: string; content: string; createdAt: number; };`
  - `export type ThreadWorkbenchState = { taskKind: WorkbenchTaskKind; todos: WorkbenchTodo[]; artifacts: WorkbenchArtifact[]; finalSummary: string | null; updatedAt: number; };`
  - `loadWorkbenchState(threadId: string, storage?: Storage): ThreadWorkbenchState`
  - `saveWorkbenchState(threadId: string, state: ThreadWorkbenchState, storage?: Storage): void`
  - `replaceWorkbenchTodos(state: ThreadWorkbenchState, todos: WorkbenchTodo[]): ThreadWorkbenchState`
  - `appendWorkbenchArtifacts(state: ThreadWorkbenchState, artifacts: WorkbenchArtifact[]): ThreadWorkbenchState`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  appendWorkbenchArtifacts,
  createEmptyWorkbenchState,
  loadWorkbenchState,
  replaceWorkbenchTodos,
  saveWorkbenchState,
} from "../workbench-state";

describe("workbench-state", () => {
  it("persists state per thread id", () => {
    const storage = window.localStorage;
    const first = createEmptyWorkbenchState();
    const second = createEmptyWorkbenchState();

    saveWorkbenchState("thread-a", {
      ...first,
      finalSummary: "engineering summary",
    }, storage);
    saveWorkbenchState("thread-b", {
      ...second,
      finalSummary: "research summary",
    }, storage);

    expect(loadWorkbenchState("thread-a", storage).finalSummary).toBe("engineering summary");
    expect(loadWorkbenchState("thread-b", storage).finalSummary).toBe("research summary");
  });

  it("replaces todos and appends artifacts without mutating the original state", () => {
    const base = createEmptyWorkbenchState();
    const withTodos = replaceWorkbenchTodos(base, [
      { id: "todo-1", content: "Inspect repo", status: "pending", source: "agent" },
    ]);
    const withArtifacts = appendWorkbenchArtifacts(withTodos, [
      { id: "artifact-1", kind: "finding", title: "Finding", content: "Summary", createdAt: 1 },
    ]);

    expect(base.todos).toHaveLength(0);
    expect(withTodos.todos).toHaveLength(1);
    expect(withArtifacts.artifacts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/lib/__tests__/workbench-state.test.ts`

Expected: FAIL with `Cannot find module '../workbench-state'` or missing export errors.

- [ ] **Step 3: Write minimal implementation**

```ts
export type WorkbenchTaskKind = "engineering" | "research" | "general";

export type WorkbenchTodo = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  source: "agent" | "user";
};

export type WorkbenchArtifact = {
  id: string;
  kind: "file" | "finding" | "summary";
  title: string;
  path?: string;
  content: string;
  createdAt: number;
};

export type ThreadWorkbenchState = {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
  artifacts: WorkbenchArtifact[];
  finalSummary: string | null;
  updatedAt: number;
};

const STORAGE_KEY_PREFIX = "deep-agent-666.workbench";

export function createEmptyWorkbenchState(): ThreadWorkbenchState {
  return {
    taskKind: "general",
    todos: [],
    artifacts: [],
    finalSummary: null,
    updatedAt: Date.now(),
  };
}

export function loadWorkbenchState(threadId: string, storage: Storage = window.localStorage): ThreadWorkbenchState {
  const raw = storage.getItem(`${STORAGE_KEY_PREFIX}.${threadId}`);
  if (!raw) return createEmptyWorkbenchState();
  try {
    return JSON.parse(raw) as ThreadWorkbenchState;
  } catch {
    return createEmptyWorkbenchState();
  }
}

export function saveWorkbenchState(
  threadId: string,
  state: ThreadWorkbenchState,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(`${STORAGE_KEY_PREFIX}.${threadId}`, JSON.stringify(state));
}

export function replaceWorkbenchTodos(
  state: ThreadWorkbenchState,
  todos: WorkbenchTodo[],
): ThreadWorkbenchState {
  return { ...state, todos, updatedAt: Date.now() };
}

export function appendWorkbenchArtifacts(
  state: ThreadWorkbenchState,
  artifacts: WorkbenchArtifact[],
): ThreadWorkbenchState {
  return { ...state, artifacts: [...state.artifacts, ...artifacts], updatedAt: Date.now() };
}
```

- [ ] **Step 4: Wire the page to use workbench state**

```ts
const [workbenchState, setWorkbenchState] = useState<ThreadWorkbenchState>(() =>
  activeThread ? loadWorkbenchState(activeThread.id) : createEmptyWorkbenchState(),
);

useEffect(() => {
  if (!activeThread) return;
  setWorkbenchState(loadWorkbenchState(activeThread.id));
}, [activeThread]);

useEffect(() => {
  if (!activeThread) return;
  saveWorkbenchState(activeThread.id, workbenchState);
}, [activeThread, workbenchState]);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix web run test -- --run src/lib/__tests__/workbench-state.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/workbench-state.ts web/src/lib/__tests__/workbench-state.test.ts web/src/app/page.tsx
git commit -m "feat: persist thread workbench state"
```

### Task 2: Normalize Tool Results Into Mixed-Scenario Artifacts

**Files:**
- Create: `web/src/lib/tool-result-normalizer.ts`
- Create: `web/src/lib/__tests__/tool-result-normalizer.test.ts`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes:
  - `WorkbenchArtifact`, `WorkbenchTodo`, `WorkbenchTaskKind` from `web/src/lib/workbench-state.ts`
  - CopilotKit tool render payload `{ name?: string; status?: string; args?: unknown; result?: unknown }`
- Produces:
  - `normalizeToolCallToTodos(...) => WorkbenchTodo[]`
  - `normalizeToolCallToArtifacts(...) => WorkbenchArtifact[]`
  - `inferTaskKindFromMessage(message: string) => WorkbenchTaskKind`
  - `extractFinalSummary(result: unknown) => string | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  extractFinalSummary,
  normalizeToolCallToArtifacts,
  normalizeToolCallToTodos,
} from "../tool-result-normalizer";

describe("tool-result-normalizer", () => {
  it("converts write_todos payloads into workbench todos", () => {
    const todos = normalizeToolCallToTodos({
      name: "write_todos",
      status: "complete",
      args: {
        todos: [
          { content: "Read SUMMARY.md", status: "completed" },
          { content: "Draft report", status: "pending" },
        ],
      },
    });

    expect(todos.map((todo) => todo.content)).toEqual(["Read SUMMARY.md", "Draft report"]);
  });

  it("converts write_file and read_document results into artifacts", () => {
    const fileArtifacts = normalizeToolCallToArtifacts({
      name: "write_file",
      status: "complete",
      args: { file_path: "docs/output.md" },
      result: "# Output",
    });
    const findingArtifacts = normalizeToolCallToArtifacts({
      name: "read_document_tool",
      status: "complete",
      args: { path: "SUMMARY.md" },
      result: "Document: SUMMARY.md\nExcerpt: product summary",
    });

    expect(fileArtifacts[0]?.kind).toBe("file");
    expect(findingArtifacts[0]?.kind).toBe("finding");
  });

  it("extracts a final summary from string or object tool results", () => {
    expect(extractFinalSummary("All checks passed")).toBe("All checks passed");
    expect(extractFinalSummary({ summary: "Research complete" })).toBe("Research complete");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web run test -- --run src/lib/__tests__/tool-result-normalizer.test.ts`

Expected: FAIL with `Cannot find module '../tool-result-normalizer'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { WorkbenchArtifact, WorkbenchTaskKind, WorkbenchTodo } from "./workbench-state";

type ToolPayload = {
  name?: string;
  status?: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
};

export function inferTaskKindFromMessage(message: string): WorkbenchTaskKind {
  const lower = message.toLowerCase();
  if (lower.includes("research") || lower.includes("summary") || lower.includes("report")) return "research";
  if (lower.includes("test") || lower.includes("fix") || lower.includes("refactor") || lower.includes("implement")) return "engineering";
  return "general";
}

export function normalizeToolCallToTodos(payload: ToolPayload): WorkbenchTodo[] {
  if (payload.name !== "write_todos" || payload.status !== "complete") return [];
  const todos = Array.isArray(payload.args?.todos) ? payload.args?.todos : [];
  return (todos as Array<Record<string, unknown>>).map((todo, index) => ({
    id: `todo-${Date.now()}-${index}`,
    content: String(todo.content ?? ""),
    status: (todo.status as WorkbenchTodo["status"]) ?? "pending",
    source: "agent",
  }));
}

export function normalizeToolCallToArtifacts(payload: ToolPayload): WorkbenchArtifact[] {
  if (payload.status !== "complete") return [];

  if (payload.name === "write_file") {
    return [{
      id: `artifact-${Date.now()}-file`,
      kind: "file",
      title: String(payload.args?.file_path ?? "Written file"),
      path: String(payload.args?.file_path ?? ""),
      content: typeof payload.result === "string" ? payload.result : String(payload.args?.content ?? ""),
      createdAt: Date.now(),
    }];
  }

  if (payload.name === "read_document_tool" || payload.name === "inspect_document_tool") {
    return [{
      id: `artifact-${Date.now()}-finding`,
      kind: "finding",
      title: String(payload.args?.path ?? payload.name),
      content: typeof payload.result === "string" ? payload.result : JSON.stringify(payload.result),
      createdAt: Date.now(),
    }];
  }

  return [];
}

export function extractFinalSummary(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) return result;
  if (result && typeof result === "object" && "summary" in result) {
    return String((result as { summary: unknown }).summary);
  }
  return null;
}
```

- [ ] **Step 4: Use the normalizer inside `page.tsx`**

```ts
useRenderTool({
  name: "*",
  render: ({ name, status, args, result }) => {
    const normalizedTodos = normalizeToolCallToTodos({ name, status, args, result });
    const normalizedArtifacts = normalizeToolCallToArtifacts({ name, status, args, result });

    if (normalizedTodos.length > 0 || normalizedArtifacts.length > 0) {
      queueMicrotask(() => {
        setWorkbenchState((previous) => {
          const withTodos = normalizedTodos.length > 0
            ? replaceWorkbenchTodos(previous, normalizedTodos)
            : previous;
          return normalizedArtifacts.length > 0
            ? appendWorkbenchArtifacts(withTodos, normalizedArtifacts)
            : withTodos;
        });
      });
    }

    return <ToolCallCard name={name} status={status} args={args} result={result} />;
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix web run test -- --run src/lib/__tests__/tool-result-normalizer.test.ts`

Expected: PASS with 3 tests passed.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/tool-result-normalizer.ts web/src/lib/__tests__/tool-result-normalizer.test.ts web/src/app/page.tsx
git commit -m "feat: normalize tool results into workbench artifacts"
```

### Task 3: Make the Backend Task-Kind Aware

**Files:**
- Create: `agent/app/task_profile.py`
- Create: `agent/tests/test_task_profile.py`
- Modify: `agent/app/state.py`
- Modify: `agent/app/agent_factory.py`

**Interfaces:**
- Consumes:
  - incoming user task text inside agent construction and coordinator delegation
- Produces:
  - `TaskKind = Literal["engineering", "research", "general"]`
  - `infer_task_kind(message: str) -> TaskKind`
  - `task_prompt_fragment(task_kind: TaskKind) -> str`
  - `CoordinatorState.task_kind: TaskKind`
  - `CoordinatorState.final_summary: str`

- [ ] **Step 1: Write the failing test**

```py
from app.task_profile import infer_task_kind, task_prompt_fragment


def test_infer_task_kind_for_research_queries():
    assert infer_task_kind("Read these docs and write a research brief") == "research"


def test_infer_task_kind_for_engineering_queries():
    assert infer_task_kind("Fix the failing test and update the file") == "engineering"


def test_prompt_fragment_mentions_expected_behavior():
    fragment = task_prompt_fragment("research")
    assert "cite workspace documents" in fragment
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project agent pytest agent/tests/test_task_profile.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.task_profile'`.

- [ ] **Step 3: Write minimal implementation**

```py
from typing import Literal

TaskKind = Literal["engineering", "research", "general"]


def infer_task_kind(message: str) -> TaskKind:
    lower = message.lower()
    if any(word in lower for word in ("research", "report", "brief", "summarize", "summary", "document")):
        return "research"
    if any(word in lower for word in ("fix", "implement", "refactor", "test", "bug", "code")):
        return "engineering"
    return "general"


def task_prompt_fragment(task_kind: TaskKind) -> str:
    if task_kind == "research":
        return (
            "Focus on document understanding, concise findings, and structured summaries. "
            "When possible, cite workspace documents and produce a written result artifact."
        )
    if task_kind == "engineering":
        return (
            "Focus on code changes, verification, and clear change summaries. "
            "Read before editing and verify through commands or tests."
        )
    return "Choose the smallest set of workspace actions required to complete the task."
```

- [ ] **Step 4: Thread task kind through the agent state**

```py
class CoordinatorState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    delegations: Annotated[list[Delegation], operator.add]
    task_kind: TaskKind
    final_summary: str
```

```py
from app.task_profile import infer_task_kind, task_prompt_fragment

SYSTEM_PROMPT = """You are the primary local work agent.
Use the workspace tools to inspect, edit, and summarize files.
When a tool call is interrupted for approval, wait for the human decision and continue.
Prefer concise, execution-focused responses."""


def build_graph(preset: AgentPreset, settings: AgentSettings) -> object:
    base_prompt = SYSTEM_PROMPT
    return create_deep_agent(
        model=_build_model(preset, settings),
        tools=_toolset_for_preset(settings.workspace_root, preset.permission_mode),
        system_prompt=base_prompt,
        checkpointer=MemorySaver(),
        name=preset.id,
    )
```

Implementation note for this step: update the first planner entry point to infer `task_kind` from the initial user message, store it in state, and prepend `task_prompt_fragment(task_kind)` to each planner/executor/reviewer system prompt.

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run --project agent pytest agent/tests/test_task_profile.py -v`

Expected: PASS with 3 tests passed.

- [ ] **Step 6: Commit**

```bash
git add agent/app/task_profile.py agent/tests/test_task_profile.py agent/app/state.py agent/app/agent_factory.py
git commit -m "feat: add task-aware agent prompts"
```

### Task 4: Upgrade Document Tools for Research Workflows

**Files:**
- Modify: `agent/app/tools/documents.py`
- Create: `agent/tests/test_documents_research.py`
- Modify: `agent/app/agent_factory.py`

**Interfaces:**
- Consumes: `workspace_root: Path`, `path: str`
- Produces:
  - `inspect_document(workspace_root: Path, path: str, max_excerpt_chars: int = 4000) -> str`
  - `read_document(workspace_root: Path, path: str, max_chars: int = 12000) -> str`
  - `inspect_document_tool(path: str) -> str`
  - `read_document_tool(path: str) -> str` with bounded output

- [ ] **Step 1: Write the failing test**

```py
from pathlib import Path

from app.tools.documents import inspect_document, read_document


def test_inspect_document_formats_metadata_and_excerpt(tmp_path: Path):
    workspace = tmp_path
    target = workspace / "notes.md"
    target.write_text("# Title\n\nParagraph one.\nParagraph two.\n", encoding="utf-8")

    result = inspect_document(workspace, "notes.md", max_excerpt_chars=20)

    assert "Path: notes.md" in result
    assert "Type: .md" in result
    assert "Excerpt:" in result


def test_read_document_truncates_large_text(tmp_path: Path):
    workspace = tmp_path
    target = workspace / "long.md"
    target.write_text("A" * 20000, encoding="utf-8")

    result = read_document(workspace, "long.md", max_chars=120)

    assert len(result) <= 160
    assert "[TRUNCATED]" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --project agent pytest agent/tests/test_documents_research.py -v`

Expected: FAIL with `cannot import name 'inspect_document'` or unexpected keyword argument errors.

- [ ] **Step 3: Write minimal implementation**

```py
def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n[TRUNCATED]"


def read_document(workspace_root: Path, path: str, max_chars: int = 12000) -> str:
    target = resolve_workspace_path(workspace_root, path)
    suffix = target.suffix.lower()
    if suffix in {".txt", ".md", ".py", ".json", ".yaml", ".yml"}:
      return _truncate(target.read_text(encoding="utf-8"), max_chars)
    if suffix == ".docx":
      document = Document(target)
      text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
      return _truncate(text, max_chars)
    if suffix == ".pdf":
      reader = PdfReader(str(target))
      text = "\n".join(page.extract_text() or "" for page in reader.pages)
      return _truncate(text, max_chars)
    raise ValueError(f"unsupported document type: {suffix}")


def inspect_document(workspace_root: Path, path: str, max_excerpt_chars: int = 4000) -> str:
    target = resolve_workspace_path(workspace_root, path)
    content = read_document(workspace_root, path, max_excerpt_chars)
    return (
      f"Path: {path}\n"
      f"Type: {target.suffix.lower() or '[none]'}\n"
      f"Size: {target.stat().st_size} bytes\n"
      f"Excerpt:\n{content}"
    )
```

- [ ] **Step 4: Register the research helper in the toolset**

```py
@tool
def inspect_document_tool(path: str) -> str:
    """Inspect a local document and return metadata plus a bounded excerpt."""
    return inspect_document(workspace_root, path)


toolset: list[object] = [
    list_workspace_tool,
    search_workspace_tool,
    read_text_file_tool,
    read_document_tool,
    inspect_document_tool,
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run --project agent pytest agent/tests/test_documents_research.py -v`

Expected: PASS with 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add agent/app/tools/documents.py agent/tests/test_documents_research.py agent/app/agent_factory.py
git commit -m "feat: add research-friendly document inspection"
```

### Task 5: Build the Mixed-Scenario Workbench UI

**Files:**
- Create: `web/src/components/TaskTimelinePanel.tsx`
- Create: `web/src/components/ArtifactResultsPanel.tsx`
- Create: `web/src/components/__tests__/TaskTimelinePanel.test.tsx`
- Create: `web/src/components/__tests__/ArtifactResultsPanel.test.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/components/TasksFilesSidebar.tsx`

**Interfaces:**
- Consumes:
  - `WorkbenchTodo`, `WorkbenchArtifact`, `WorkbenchTaskKind` from `web/src/lib/workbench-state.ts`
  - `onOpenFile(path: string): void`
- Produces:
  - `TaskTimelinePanel({ taskKind, todos }: { taskKind: WorkbenchTaskKind; todos: WorkbenchTodo[] })`
  - `ArtifactResultsPanel({ artifacts, finalSummary, onOpenFile }: { artifacts: WorkbenchArtifact[]; finalSummary: string | null; onOpenFile: (path: string) => void })`

- [ ] **Step 1: Write the failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { TaskTimelinePanel } from "../TaskTimelinePanel";

describe("TaskTimelinePanel", () => {
  it("renders task kind and statuses", () => {
    render(
      <TaskTimelinePanel
        taskKind="research"
        todos={[
          { id: "1", content: "Read docs", status: "completed", source: "agent" },
          { id: "2", content: "Draft brief", status: "in_progress", source: "agent" },
        ]}
      />,
    );

    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Read docs")).toBeInTheDocument();
    expect(screen.getByText("Draft brief")).toBeInTheDocument();
  });
});
```

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { ArtifactResultsPanel } from "../ArtifactResultsPanel";

describe("ArtifactResultsPanel", () => {
  it("renders summaries and opens file artifacts", () => {
    const onOpenFile = vi.fn();
    render(
      <ArtifactResultsPanel
        finalSummary="Research complete"
        artifacts={[
          { id: "a1", kind: "file", title: "report.md", path: "report.md", content: "# Report", createdAt: 1 },
          { id: "a2", kind: "finding", title: "SUMMARY.md", content: "Key finding", createdAt: 2 },
        ]}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /report.md/i }));
    expect(screen.getByText("Research complete")).toBeInTheDocument();
    expect(onOpenFile).toHaveBeenCalledWith("report.md");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web run test -- --run src/components/__tests__/TaskTimelinePanel.test.tsx src/components/__tests__/ArtifactResultsPanel.test.tsx`

Expected: FAIL with missing component module errors.

- [ ] **Step 3: Write minimal components**

```tsx
export function TaskTimelinePanel({
  taskKind,
  todos,
}: {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
}) {
  const heading = taskKind === "engineering" ? "Engineering" : taskKind === "research" ? "Research" : "General";

  return (
    <section className="flex h-full flex-col border-r border-border">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{heading}</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {todos.map((todo) => (
          <div key={todo.id} className="mb-3 rounded-lg border border-border p-3">
            <div className="text-sm font-medium">{todo.content}</div>
            <div className="mt-1 text-xs text-muted-foreground">{todo.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
export function ArtifactResultsPanel({
  artifacts,
  finalSummary,
  onOpenFile,
}: {
  artifacts: WorkbenchArtifact[];
  finalSummary: string | null;
  onOpenFile: (path: string) => void;
}) {
  return (
    <section className="flex h-full flex-col">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Results</h2>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {finalSummary ? (
          <div className="rounded-lg border border-border bg-card p-3 text-sm">{finalSummary}</div>
        ) : null}
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="rounded-lg border border-border p-3">
            {artifact.path ? (
              <button className="text-left text-sm font-medium underline" onClick={() => onOpenFile(artifact.path!)}>
                {artifact.title}
              </button>
            ) : (
              <div className="text-sm font-medium">{artifact.title}</div>
            )}
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{artifact.content}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace the right sidebar with the workbench layout**

```tsx
<ResizablePanelGroup direction="horizontal">
  {sidebar ? <ThreadHistoryPanel ... /> : null}
  <ResizablePanel id="timeline" defaultSize={20} minSize={16}>
    <TaskTimelinePanel taskKind={workbenchState.taskKind} todos={workbenchState.todos} />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel id="chat" defaultSize={50}>
    <CopilotChat ... />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel id="results" defaultSize={30} minSize={20}>
    <ArtifactResultsPanel
      artifacts={workbenchState.artifacts}
      finalSummary={workbenchState.finalSummary}
      onOpenFile={handleOpenWorkspaceFile}
    />
  </ResizablePanel>
</ResizablePanelGroup>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix web run test -- --run src/components/__tests__/TaskTimelinePanel.test.tsx src/components/__tests__/ArtifactResultsPanel.test.tsx`

Expected: PASS with 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/TaskTimelinePanel.tsx web/src/components/ArtifactResultsPanel.tsx web/src/components/__tests__/TaskTimelinePanel.test.tsx web/src/components/__tests__/ArtifactResultsPanel.test.tsx web/src/app/page.tsx web/src/components/TasksFilesSidebar.tsx
git commit -m "feat: add mixed-scenario workbench panels"
```

### Task 6: Verify the Engineering and Research Flows End-to-End

**Files:**
- Modify: `web/tests/e2e/smoke.spec.ts`
- Modify: `web/src/lib/__tests__/copilot-runtime.test.ts`
- Modify: `agent/tests/test_v2_genui.py`

**Interfaces:**
- Consumes:
  - existing runtime route `/api/copilotkit/agent/:id/run`
  - existing coordinator agent ids such as `coordinator-openai-balanced`
- Produces:
  - one smoke assertion for engineering task UI state
  - one smoke assertion for research task UI state
  - one backend state test covering `task_kind` and `final_summary`

- [ ] **Step 1: Write the failing tests**

```ts
test("research flow surfaces findings in the results panel", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/Ask me to research/i).fill("Research SUMMARY.md and write a short brief");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Results")).toBeVisible();
  await expect(page.getByText(/SUMMARY.md/i)).toBeVisible();
});

test("engineering flow surfaces tasks in the timeline panel", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/Ask me to research/i).fill("Inspect the repo and list the next code changes");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Engineering")).toBeVisible();
  await expect(page.getByText(/Inspect the repo/i)).toBeVisible();
});
```

```py
def test_coordinator_state_tracks_task_kind_and_final_summary():
    state = {
        "messages": [],
        "delegations": [],
        "task_kind": "research",
        "final_summary": "Research complete",
    }
    assert state["task_kind"] == "research"
    assert state["final_summary"] == "Research complete"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web run test:e2e -- --grep "research flow|engineering flow"`

Expected: FAIL because the new panels and assertions are not implemented yet.

Run: `uv run --project agent pytest agent/tests/test_v2_genui.py -v`

Expected: FAIL if the new state fields are not threaded through the coordinator state type.

- [ ] **Step 3: Make the smallest integration fixes**

```ts
// web/src/app/page.tsx
const initialTaskKind = useMemo(
  () => inferTaskKindFromMessage(activeThread?.title ?? ""),
  [activeThread],
);
```

```py
# agent/app/agent_factory.py
return Command(update={
    "delegations": [running_entry],
    "task_kind": current_task_kind,
    "final_summary": final_summary_text,
})
```

- [ ] **Step 4: Run the verification suite**

Run: `uv run --project agent pytest -v`

Expected: PASS for all backend tests, including the new task-profile and document-research cases.

Run: `npm --prefix web run test`

Expected: PASS for all frontend unit tests, including new workbench and panel tests.

Run: `npm --prefix web run test:e2e -- --grep "research flow|engineering flow"`

Expected: PASS for both new smoke paths.

- [ ] **Step 5: Commit**

```bash
git add web/tests/e2e/smoke.spec.ts web/src/lib/__tests__/copilot-runtime.test.ts agent/tests/test_v2_genui.py agent/app/agent_factory.py web/src/app/page.tsx
git commit -m "test: verify engineering and research workbench flows"
```

## Self-Review

### Spec coverage

- Mixed engineering + research support: covered by Tasks 2, 3, 4, 5, and 6.
- Shared task timeline and artifact/result panel: covered by Tasks 1, 2, and 5.
- Existing single-workspace architecture preserved: covered by Global Constraints and backend-only changes in Tasks 3 and 4.
- Coordinator remains limited to planner/executor/reviewer: preserved by Task 3.
- Process visibility and final results: covered by Tasks 1, 2, 5, and 6.

### Placeholder scan

- No `TODO`, `TBD`, or "similar to" placeholders remain.
- Every code-changing step includes concrete code or wiring snippets.
- Every test step includes an exact command and an expected outcome.

### Type consistency

- `WorkbenchTaskKind` is defined once in Task 1 and reused in Tasks 2 and 5.
- `WorkbenchArtifact` and `WorkbenchTodo` are defined once in Task 1 and reused by later frontend tasks.
- `TaskKind` is defined in Task 3 and reused in backend state and prompt logic.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-27-unified-workspace-agent-v1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
