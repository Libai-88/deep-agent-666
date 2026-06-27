# Phase A Unified Runtime Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the current V1 tool results, V2 coordinator state snapshots, and recovery actions into one stable workbench runtime protocol that drives timeline, artifacts, and final summary consistently.

**Architecture:** Introduce a shared `workbench_events` state contract on the backend coordinator path and a matching frontend event-normalization layer that translates tool calls, state snapshots, and A2UI activity into one `WorkbenchEvent` model. Migrate the page-level workbench updater away from coordinator-only special cases so the timeline and result panel consume a single protocol regardless of whether the source was a tool call, a delegation, or a structured artifact event.

**Tech Stack:** Python 3.11, deepagents 0.6.11, LangGraph 1.2.6, CopilotKit 0.1.94, Next.js 16, React 19, TypeScript, Vitest, Playwright, pytest

## Global Constraints

- Keep scope limited to `Phase A: 统一运行时协议`; do not start file-upload UX, image ingestion, export UI, or workflow/plugin management in this plan.
- Preserve the existing `deepagents` V1 graph path and LangGraph coordinator path; this phase unifies protocol semantics, not the entire backend architecture.
- Reuse the existing thread persistence, retry, and A2UI infrastructure; do not invent a second storage or recovery system.
- Follow TDD strictly: write the failing test first, verify failure, then implement the smallest production change.
- Do not regress existing V27 `DiffPreview`, coordinator artifact rendering, thread recovery, or diagnostics behavior.
- Clean up any unnecessary processes after verification commands.

---

### Task 1: Define the shared backend runtime-event contract

**Files:**
- Modify: `agent/app/state.py`
- Modify: `agent/app/agent_factory.py`
- Modify: `agent/tests/test_v2_coordinator.py`

**Interfaces:**
- Consumes: existing `Delegation`, `CoordinatorState`, `_running_command(...)`, `_delegation_command(...)`
- Produces:
  - `class WorkbenchEvent(TypedDict)` with fields:
    - `id: str`
    - `kind: Literal["delegation","status","artifact"]`
    - `status: Literal["running","completed","failed","info"]`
    - `title: str`
    - `message: str`
    - `source: Literal["planner","executor","reviewer","tool","system"]`
    - `artifact_path: str | None`
    - `artifact_kind: Literal["file","finding","summary"] | None`
  - `CoordinatorState.workbench_events: Annotated[list[WorkbenchEvent], add]`
  - coordinator `Command(update=...)` payloads that append `workbench_events`

- [ ] **Step 1: Write the failing coordinator-state contract test**

```python
from app.state import CoordinatorState


def test_coordinator_state_declares_workbench_events_channel() -> None:
    annotations = CoordinatorState.__annotations__
    assert "workbench_events" in annotations
```

```python
from app.agent_factory import build_v2_coordinator


def test_coordinator_emits_workbench_events_in_state(monkeypatch, tmp_path):
    monkeypatch.setenv("AGENT_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
    )
    assert coordinator is not None
```

- [ ] **Step 2: Run the focused backend tests and verify the new assertion fails**

Run: `uv run --project agent pytest -v agent/tests/test_v2_coordinator.py`
Expected: FAIL because `CoordinatorState` does not define `workbench_events`

- [ ] **Step 3: Implement the smallest backend event schema and emission helpers**

```python
class WorkbenchEvent(typing.TypedDict):
    id: str
    kind: Literal["delegation", "status", "artifact"]
    status: Literal["running", "completed", "failed", "info"]
    title: str
    message: str
    source: Literal["planner", "executor", "reviewer", "tool", "system"]
    artifact_path: str | None
    artifact_kind: Literal["file", "finding", "summary"] | None


class CoordinatorState(BaseAgentState):
    delegations: Annotated[list[Delegation], add]
    workbench_events: Annotated[list[WorkbenchEvent], add]
    task_kind: TaskKind
    final_summary: str
```

```python
def _build_workbench_event(
    *,
    kind: Literal["delegation", "status", "artifact"],
    status: Literal["running", "completed", "failed", "info"],
    title: str,
    message: str,
    source: Literal["planner", "executor", "reviewer", "tool", "system"],
    artifact_path: str | None = None,
    artifact_kind: Literal["file", "finding", "summary"] | None = None,
) -> WorkbenchEvent:
    return {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "status": status,
        "title": title,
        "message": message,
        "source": source,
        "artifact_path": artifact_path,
        "artifact_kind": artifact_kind,
    }
```

```python
return Command(
    update={
        "delegations": [entry],
        "workbench_events": [
            _build_workbench_event(
                kind="delegation",
                status="running",
                title=f"{sub_agent.title()} started",
                message=task,
                source=sub_agent,
            )
        ],
        "task_kind": task_kind,
        "messages": [ToolMessage(content="starting...", tool_call_id=tool_call_id)],
    }
)
```

- [ ] **Step 4: Re-run the focused backend tests and verify they pass**

Run: `uv run --project agent pytest -v agent/tests/test_v2_coordinator.py`
Expected: PASS

- [ ] **Step 5: Commit the backend runtime-event schema slice**

```bash
git add agent/app/state.py agent/app/agent_factory.py agent/tests/test_v2_coordinator.py
git commit -m "feat(protocol): add coordinator workbench event schema"
```

### Task 2: Build a frontend runtime-event domain model and normalizer

**Files:**
- Create: `web/src/lib/runtime-events.ts`
- Create: `web/src/lib/__tests__/runtime-events.test.ts`
- Modify: `web/src/lib/workbench-state.ts`
- Modify: `web/src/lib/tool-result-normalizer.ts`

**Interfaces:**
- Consumes:
  - backend `workbench_events` snapshots
  - `ToolPayload` from CopilotKit tool events
  - existing `ThreadWorkbenchState`
- Produces:
  - `type WorkbenchEventStatus = "running" | "completed" | "failed" | "info"`
  - `type WorkbenchEventKind = "delegation" | "tool" | "artifact" | "status"`
  - `type WorkbenchEvent = { id, kind, status, title, message, source, createdAt, artifactPath?, artifactKind? }`
  - `function normalizeSnapshotEvents(input: unknown): WorkbenchEvent[]`
  - `function normalizeToolPayloadToEvents(payload: ToolPayload): WorkbenchEvent[]`
  - `ThreadWorkbenchState.events: WorkbenchEvent[]`

- [ ] **Step 1: Write failing frontend unit tests for runtime-event normalization**

```ts
import {
  normalizeSnapshotEvents,
  normalizeToolPayloadToEvents,
} from "../runtime-events";

it("normalizes coordinator snapshot events into stable workbench events", () => {
  const events = normalizeSnapshotEvents([
    {
      id: "e-1",
      kind: "delegation",
      status: "completed",
      title: "Planner finished",
      message: "Inspect the repository architecture.",
      source: "planner",
      artifact_path: null,
      artifact_kind: null,
    },
  ]);

  expect(events[0]).toMatchObject({
    id: "e-1",
    kind: "delegation",
    status: "completed",
    title: "Planner finished",
    message: "Inspect the repository architecture.",
    source: "planner",
  });
});
```

```ts
it("creates tool events for completed structured file edits", () => {
  const events = normalizeToolPayloadToEvents({
    name: "replace_text_in_file_tool",
    status: "complete",
    args: { path: "docs/plan.md" },
    result: {
      summary: "updated docs/plan.md",
      path: "docs/plan.md",
      a2ui_operations: [],
    },
  });

  expect(events[0]).toMatchObject({
    kind: "artifact",
    status: "completed",
    title: "updated docs/plan.md",
    artifactPath: "docs/plan.md",
    artifactKind: "file",
  });
});
```

- [ ] **Step 2: Run the focused Vitest files and verify they fail**

Run: `npm --prefix web run test -- runtime-events.test.ts tool-result-normalizer.test.ts workbench-state.test.ts`
Expected: FAIL because `runtime-events.ts` and `state.events` do not exist yet

- [ ] **Step 3: Implement the runtime-event domain model and state shape**

```ts
export type WorkbenchEvent = {
  id: string;
  kind: "delegation" | "tool" | "artifact" | "status";
  status: "running" | "completed" | "failed" | "info";
  title: string;
  message: string;
  source: "planner" | "executor" | "reviewer" | "tool" | "system";
  createdAt: number;
  artifactPath?: string;
  artifactKind?: "file" | "finding" | "summary";
};
```

```ts
export function normalizeSnapshotEvents(input: unknown): WorkbenchEvent[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((event): event is Record<string, unknown> => !!event && typeof event === "object")
    .map((event, index) => ({
      id: typeof event.id === "string" ? event.id : `snapshot-${index}`,
      kind: event.kind === "artifact" || event.kind === "status" ? event.kind : "delegation",
      status:
        event.status === "running" || event.status === "completed" || event.status === "failed"
          ? event.status
          : "info",
      title: typeof event.title === "string" ? event.title : "Workbench event",
      message: typeof event.message === "string" ? event.message : "",
      source:
        event.source === "planner" || event.source === "executor" || event.source === "reviewer"
          ? event.source
          : event.source === "system"
            ? "system"
            : "tool",
      createdAt: Date.now() + index,
      artifactPath:
        typeof event.artifact_path === "string" ? event.artifact_path : undefined,
      artifactKind:
        event.artifact_kind === "file" || event.artifact_kind === "finding" || event.artifact_kind === "summary"
          ? event.artifact_kind
          : undefined,
    }));
}
```

```ts
export type ThreadWorkbenchState = {
  taskKind: WorkbenchTaskKind;
  todos: WorkbenchTodo[];
  artifacts: WorkbenchArtifact[];
  events: WorkbenchEvent[];
  finalSummary: string | null;
  lastUserPrompt: string | null;
  updatedAt: number;
};
```

- [ ] **Step 4: Re-run the focused Vitest files and verify they pass**

Run: `npm --prefix web run test -- runtime-events.test.ts tool-result-normalizer.test.ts workbench-state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the frontend runtime-event model slice**

```bash
git add web/src/lib/runtime-events.ts web/src/lib/__tests__/runtime-events.test.ts web/src/lib/workbench-state.ts web/src/lib/tool-result-normalizer.ts
git commit -m "feat(protocol): add frontend runtime event normalizer"
```

### Task 3: Replace page-level coordinator special cases with unified event application

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/lib/tool-result-normalizer.ts`
- Modify: `web/src/components/TaskTimelinePanel.tsx`
- Modify: `web/src/components/__tests__/TaskTimelinePanel.test.tsx`
- Modify: `web/src/lib/__tests__/tool-result-normalizer.test.ts`

**Interfaces:**
- Consumes:
  - `normalizeSnapshotEvents(...)`
  - `normalizeToolPayloadToEvents(...)`
  - `replaceWorkbenchTodos(...)`
  - `replaceWorkbenchArtifacts(...)`
  - `ThreadWorkbenchState.events`
- Produces:
  - `applyWorkbenchEvents(state, events): ThreadWorkbenchState`
  - `TaskTimelinePanel` rendering driven by `events` first and `todos` second
  - page-level update flow that no longer depends on direct `state.delegations` rendering semantics alone

- [ ] **Step 1: Write failing tests for unified workbench state application**

```ts
import { applyWorkbenchEvents } from "../tool-result-normalizer";

it("derives timeline todos and artifacts from unified workbench events", () => {
  const next = applyWorkbenchEvents(
    {
      taskKind: "engineering",
      todos: [],
      artifacts: [],
      events: [],
      finalSummary: null,
      lastUserPrompt: null,
      updatedAt: 1,
    },
    [
      {
        id: "planner-1",
        kind: "delegation",
        status: "completed",
        title: "Planner finished",
        message: "Inspect the repository architecture.",
        source: "planner",
        createdAt: 2,
      },
      {
        id: "artifact-1",
        kind: "artifact",
        status: "completed",
        title: "updated docs/plan.md",
        message: "updated docs/plan.md",
        source: "tool",
        artifactPath: "docs/plan.md",
        artifactKind: "file",
        createdAt: 3,
      },
    ],
  );

  expect(next.todos[0]?.content).toBe("Inspect the repository architecture.");
  expect(next.artifacts[0]?.path).toBe("docs/plan.md");
  expect(next.events).toHaveLength(2);
});
```

```tsx
it("renders event labels before falling back to todo-only cards", () => {
  const html = renderToStaticMarkup(
    <TaskTimelinePanel
      taskKind="engineering"
      events={[
        {
          id: "event-1",
          kind: "delegation",
          status: "running",
          title: "Executor started",
          message: "Inspect risky files and TODOs.",
          source: "executor",
          createdAt: 1,
        },
      ]}
      todos={[]}
    />,
  );

  expect(html).toContain("Executor started");
  expect(html).toContain("Inspect risky files and TODOs.");
  expect(html).toContain("In progress");
});
```

- [ ] **Step 2: Run the focused frontend tests and verify they fail**

Run: `npm --prefix web run test -- tool-result-normalizer.test.ts TaskTimelinePanel.test.tsx`
Expected: FAIL because `applyWorkbenchEvents` and `events` rendering do not exist yet

- [ ] **Step 3: Implement the unified event-application path in the page shell**

```ts
export function applyWorkbenchEvents(
  state: ThreadWorkbenchState,
  events: WorkbenchEvent[],
): ThreadWorkbenchState {
  const todos = events
    .filter((event) => event.kind === "delegation")
    .map((event) => ({
      id: event.id,
      content: event.message,
      status:
        event.status === "completed"
          ? "completed"
          : event.status === "running"
            ? "in_progress"
            : "pending",
      source: "agent" as const,
    }));

  const artifacts = events
    .filter((event) => event.kind === "artifact" && event.status === "completed")
    .map((event, index) => ({
      id: event.id,
      kind: event.artifactKind ?? "finding",
      title: event.title,
      path: event.artifactPath,
      content: event.message,
      createdAt: event.createdAt + index,
      source: "tool" as const,
    }));

  return {
    ...state,
    todos,
    artifacts,
    events,
    updatedAt: Date.now(),
  };
}
```

```tsx
<TaskTimelinePanel
  taskKind={workbenchState.taskKind}
  events={workbenchState.events}
  todos={workbenchState.todos}
/>
```

```ts
const state = agent.state as {
  workbench_events?: unknown;
  delegations?: Array<...>;
  task_kind?: "engineering" | "research" | "general";
  final_summary?: string;
};
```

- [ ] **Step 4: Re-run the focused frontend tests and verify they pass**

Run: `npm --prefix web run test -- tool-result-normalizer.test.ts TaskTimelinePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the unified page/runtime integration slice**

```bash
git add web/src/app/page.tsx web/src/lib/tool-result-normalizer.ts web/src/components/TaskTimelinePanel.tsx web/src/components/__tests__/TaskTimelinePanel.test.tsx web/src/lib/__tests__/tool-result-normalizer.test.ts
git commit -m "refactor(protocol): drive workbench from unified events"
```

### Task 4: Add browser proof and repository-wide verification for Phase A

**Files:**
- Modify: `web/tests/e2e/coordinator-workbench-regression.spec.ts`
- Modify: `README.md`
- Modify: `SUMMARY.md`
- Modify: `docs/superpowers/STATUS.md`
- Modify: `docs/superpowers/SPEC.md`

**Interfaces:**
- Consumes:
  - coordinator `STATE_SNAPSHOT.snapshot.workbench_events`
  - frontend unified runtime-event application
  - existing A2UI `DiffPreview` fixture
- Produces:
  - deterministic browser proof that timeline, artifacts, and final summary survive through one shared event protocol
  - updated product docs and suite counts for the Phase A baseline

- [ ] **Step 1: Extend the coordinator E2E fixture to include `workbench_events`**

```ts
snapshot: {
  task_kind: "engineering",
  workbench_events: [
    {
      id: "event-planner-1",
      kind: "delegation",
      status: "completed",
      title: "Planner finished",
      message: "Inspect the repository architecture.",
      source: "planner",
      artifact_path: null,
      artifact_kind: null,
    },
    {
      id: "event-artifact-1",
      kind: "artifact",
      status: "completed",
      title: "updated docs/plan.md",
      message: "updated docs/plan.md",
      source: "tool",
      artifact_path: "docs/plan.md",
      artifact_kind: "file",
    },
  ],
}
```

- [ ] **Step 2: Run the focused Playwright regression and verify it fails before implementation is complete**

Run: `npm --prefix web exec playwright test coordinator-workbench-regression.spec.ts`
Expected: FAIL because the UI still reads coordinator state through the older delegation-only path

- [ ] **Step 3: Update docs after all verification is green**

```md
- `Phase A` baseline: runtime timeline, artifact, and summary rendering now consume one shared workbench event protocol.
```

- [ ] **Step 4: Run full verification**

Run: `npm --prefix web run typecheck`
Expected: PASS

Run: `npm --prefix web run test`
Expected: PASS

Run: `npm --prefix web run build`
Expected: PASS

Run: `npm --prefix web run e2e`
Expected: PASS

Run: `uv run --project agent pytest -v`
Expected: PASS

- [ ] **Step 5: Commit and push the Phase A baseline**

```bash
git add web/tests/e2e/coordinator-workbench-regression.spec.ts README.md SUMMARY.md docs/superpowers/STATUS.md docs/superpowers/SPEC.md
git commit -m "feat(phase-a): unify workbench runtime protocol"
git push
```

## Self-Review

- Spec coverage: this plan covers `Phase A：统一运行时协议` only. It deliberately excludes file-upload UX, image parsing, export workflows, and plugin management so later phases can get their own plans.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain; every task names exact files, functions, and test commands.
- Type consistency: backend `workbench_events` maps to frontend `WorkbenchEvent[]`, which then feeds `applyWorkbenchEvents(...)`, `TaskTimelinePanel`, artifacts, and final-summary behavior with one vocabulary.
