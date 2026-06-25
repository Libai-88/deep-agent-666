# V2: Subagent Delegation + GenUI Middleware Design

> Date: 2026-06-25
> Status: Draft for review
> Builds on: V1 Foundation (`2026-06-24-deepagents-copilotkit-agent-design.md`)

## Goal

Extend the V1 single-agent loop with Subagent delegation and Generative UI, making Deep Agents' unique orchestration capabilities visible and useful for end users — without adding complexity that overwhelms beginners.

## Guiding Principles

| Principle | Source |
|-----------|--------|
| **Build on V1, don't rebuild** | Existing 4-layer architecture (Agent Core → Copilot Bridge → Web Client → Future Windows Shell) stays intact. V2 adds layers, doesn't replace them |
| **Target user = beginner** | No IDE-level editors. No multi-panel dashboards. Default views must be clean; advanced details are one click away |
| **Use official CopilotKit integration patterns** | CopilotKit docs → State Rendering (`useCoAgentStateRender`), Tool Rendering (`useRenderTool`), Deep Agents middleware (`copilotkit_emit_state`) |
| **Lean on proven open-source patterns** | `deep-agents-ui` (SubAgentIndicator, task tracking), `deepagent-gen-ui` (GenUI middleware), `agent-studio-starter` (tool rendering) |
| **YAGNI** | Don't build features V2 doesn't need. MCP, Windows Shell, plugin marketplace are postponed |

## Reference Sources

### Official CopilotKit Docs (via MCP)

- [State Rendering for Deep Agents](https://docs.copilotkit.ai/integrations/deepagents/generative-ui/state-rendering) — `copilotkit_emit_state` + `useCoAgentStateRender`
- [Tool Rendering](https://docs.copilotkit.ai/generative-ui/tool-rendering) — `useRenderTool` with custom cards
- [Generative UI Overview](https://docs.copilotkit.ai/concepts/generative-ui-overview) — Components as Tools / State Rendering decision matrix
- [Deep Agents Quickstart](https://docs.copilotkit.ai/integrations/deepagents/quickstart) — `CopilotKitState` + middleware setup

### Open Source References

- `deep-agents-ui` (langchain-ai) — `SubAgentIndicator`, `ChatMessage` with subagent delegation display, `TasksFilesSidebar`, `ToolCallBox`
- `deepagent-gen-ui` (langchain-samples) — `GenUIMiddleware` intercepting tool calls, dynamic component rendering via `useStreamContext`
- `agent-studio-starter` (nsphung) — `useRenderToolCall` for weather cards, `LangGraphHttpAgent` + CopilotKit middleware integration
- `CopilotKit examples/showcases/deep-agents` — `Workspace.tsx` panel, `ToolCard` with 6 tool configurations

## Architecture: V1 + V2 Layered

```
V1 layers (unchanged):
┌──────────────────────────────────────────────┐
│  Web Client (Next.js + shadcn)               │
├──────────────────────────────────────────────┤
│  Copilot Bridge (Runtime route + HITL)       │
├──────────────────────────────────────────────┤
│  Agent Core (FastAPI + 9 presets)            │
└──────────────────────────────────────────────┘

V2 additions (new):
┌──────────────────────────────────────────────┐
│  Workspace File Browser (new panel)           │
│  GenUI Components (DiffViewer, DataChart)     │
│  SubAgentIndicator (delegation display)       │
│  useCoAgentStateRender (state-driven UI)      │
├──────────────────────────────────────────────┤
│  Python: GenUIMiddleware (intercept tools)     │
│  Python: copilotkit_emit_state (progress)      │
├──────────────────────────────────────────────┤
│  Plan → Do → Review coordinator agent         │
│  Subagents: planner, executor, reviewer       │
└──────────────────────────────────────────────┘
```

Key: V2 components sit on top of V1 without modifying the existing agent core, bridge, or UI shell. Each V2 feature can be developed independently.

## Component Design

### 1. Backend: Plan → Do → Review Coordinator

**Official reference:** CopilotKit Deep Agents Quickstart → `CopilotKitState` + `create_deep_agent` with subagents
**Open source reference:** `deep-agent-666` V1 `agent_factory.py` (existing `build_langgraph_agents`)

The V1 `agent_factory.py` builds a single agent per preset. V2 adds a coordinator layer:

```python
# Pseudocode — coordinator with 3 subagents
coordinator = create_deep_agent(
    model=...,
    tools=[delegate_to_planner, delegate_to_executor, delegate_to_reviewer],
    subagents=[
        {"name": "planner",   "description": "Analyze task and break into steps"},
        {"name": "executor",  "description": "Execute planned steps with tools"},
        {"name": "reviewer",  "description": "Verify results against plan"},
    ],
    middleware=[copilotkit_middleware],
)
```

**State design** (extends `CopilotKitState`):

```python
class V2AgentState(CopilotKitState):
    phase: str  # "planning" | "executing" | "reviewing" | "done"
    plan_steps: list[dict]  # From planner
    completed_steps: list[dict]
    file_changes: list[dict]  # For diff tracking
    review_result: str | None
```

**Flow:**

```
User request
  → coordinator: plan (delegate to planner subagent)
    → emit phase="planning", plan_steps=[...] via copilotkit_emit_state
  → coordinator: execute (delegate to executor subagent)
    → emit phase="executing", completed_steps=[...] via copilotkit_emit_state
  → coordinator: review (delegate to reviewer subagent)
    → emit phase="reviewing", review_result=... via copilotkit_emit_state
  → coordinator: synthesize final answer
    → emit phase="done"
```

**Official basis:** `copilotkit_emit_state` (from `copilotkit.langgraph`) pushes intermediate state to the frontend before a node finishes. The frontend consumes it via `useCoAgentStateRender`.

### 2. Backend: GenUI Middleware

**Official reference:** CopilotKit docs → Tool Rendering, State Rendering
**Open source reference:** `deepagent-gen-ui` → `ui_middleware.py`

V2 adds a middleware layer that intercepts specific tool calls and emits structured data for the frontend to render as custom UI:

| Tool | Intercepted by GenUI | Frontend renders |
|------|---------------------|-----------------|
| `write_text_file` / `replace_text_in_file` | Capture before/after content | `DiffViewer` component |
| `run_command` with tabular output | Capture stdout as structured data | `DataTable` + optional chart |
| Coordinator `plan_steps` state | Emitted via `copilotkit_emit_state` | Step-by-step checklist |

**Implementation pattern:**

```python
from copilotkit.langgraph import copilotkit_emit_state

async def genui_middleware(state: V2AgentState, config):
    """Intercept tool results and emit structured data for UI."""
    if state.get("file_changes"):
        await copilotkit_emit_state(config, {
            "genui_diff": state["file_changes"][-1],  # Latest change
        })
    if state.get("phase") == "planning" and state.get("plan_steps"):
        await copilotkit_emit_state(config, {
            "genui_plan": state["plan_steps"],
        })
```

**Official basis:** CopilotKit State Rendering docs state: "Emit state updates from your agent using `copilotkit_emit_state` to push intermediate state to the frontend before a node finishes."

### 3. Frontend: SubAgentIndicator

**Official reference:** CopilotKit docs → `useCoAgentStateRender` / `useAgent`
**Open source reference:** `deep-agents-ui` → `SubAgentIndicator.tsx`

A thin component that monitors the agent's phase and displays current progress:

```tsx
// Pseudocode
import { useCoAgentStateRender } from "@copilotkit/react-core/v2";

function SubAgentProgress() {
  const { state } = useCoAgentStateRender<V2AgentState>({ agentId: "coordinator" });

  if (!state?.phase) return null;

  return (
    <div className="space-y-2">
      <PhaseIndicator current={state.phase} />
      {state.plan_steps && <PlanSteps steps={state.plan_steps} />}
      {state.completed_steps && <CompletedSteps steps={state.completed_steps} />}
    </div>
  );
}
```

**Display rules (aggregated mode — per user's decision):**
- Default: coordinator shows one aggregated message with a small progress badge
- Expandable: clicking the badge reveals phase details and subagent activity
- Three phases each have a distinct color: plan (blue) → do (purple) → review (teal)

### 4. Frontend: DiffViewer (GenUI — P0)

**Official reference:** CopilotKit docs → State Rendering with `useCoAgentStateRender`
**Open source reference:** GitHub diff view pattern (standard)

When the GenUI middleware emits `genui_diff`, render a side-by-side file diff:

```tsx
function DiffViewer({ before, after, filePath }: DiffProps) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border px-3 py-2 text-xs font-medium">
        {filePath}
      </div>
      <pre className="overflow-x-auto p-3 text-xs">
        {/* Line-by-line diff with +/- markers and color coding */}
        {computeDiff(before, after).map((line, i) => (
          <div key={i} className={line.type === "add" ? "bg-green-50 text-green-800" 
            : line.type === "remove" ? "bg-red-50 text-red-800" 
            : "text-foreground"}>
            {line.content}
          </div>
        ))}
      </pre>
    </div>
  );
}
```

### 5. Frontend: DataChart / DataTable (GenUI — P1)

**Official reference:** CopilotKit docs → State Rendering
**Open source reference:** `agent-studio-starter` → weather card rendering

When the agent produces structured tabular data, render a sortable table. If data shape supports it, add a simple chart toggle:

- CSV-like data → Sortable table
- Numeric series → Optional bar chart (using inline SVG, no external chart library — keeps dependencies lightweight)
- Both render inside a collapsible card in the chat

### 6. Frontend: Workspace File Browser

**Independent of GenUI** — a dedicated panel that lists workspace files and lets users preview them.

**Open source reference:** `deep-agents-ui` → `TasksFilesSidebar` (file list), CopilotKit `deep-agents` example → `FileViewerModal`

**Backend dependency:** New Python endpoint `GET /workspace/files?path=...` and `GET /workspace/file?path=...` that wraps the existing `list_workspace` and `read_text_file` tools for direct frontend access.

```python
@app.get("/workspace/files")
async def list_directory(path: str = ""):
    """List files at the given subpath under workspace_root."""
    return await list_workspace({"path": path})

@app.get("/workspace/file")
async def read_file(path: str):
    """Read a file's content."""
    return await read_text_file({"file_path": path})
```

**Frontend:**
- Integrates with existing three-panel layout (replacing TasksFilesSidebar or added as a tab within it)
- Shows directory tree with expandable folders
- Click a file → preview in the existing `FileViewDialog`
- Agent-modified files get a small "changed" indicator

## Data Flow (Complete V2 Run)

```
1. User: "Refactor the api routes and add error handling"

       │
       ▼
2. Coordinator receives task
   └─ phase="planning"
   └─ copilotkit_emit_state({ genui_plan: [...] })
       │
       ▼ Frontend: SubAgentProgress shows plan steps
       │
3. Coordinator delegates to planner subagent
   └─ Returns structured plan with file list and changes
       │
       ▼
4. phase="executing"
   └─ Coordinator delegates to executor subagent
       └─ Reads files, modifies code, runs tests
       └─ GenUI middleware captures file diffs
       └─ copilotkit_emit_state({ genui_diff: {...} })
       │
       ▼ Frontend: DiffViewer shows before/after
       │
5. phase="reviewing"
   └─ Coordinator delegates to reviewer subagent
       └─ Verifies changes, checks for errors
       └─ copilotkit_emit_state({ review_result: "..." })
       │
       ▼ Frontend: ReviewSummary shows verification result
       │
6. phase="done"
   └─ Coordinator synthesizes final answer
   └─ Complete summary in chat + expanded subagent details
```

## File Change Summary

### Backend (agent/)

| File | Change | Purpose |
|------|--------|---------|
| `agent/app/agent_factory.py` | **MODIFY** | Add `build_v2_coordinator` with subagents (plan/do/review) |
| `agent/app/agent_factory.py` | **MODIFY** | Register GenUI middleware in agent build |
| `agent/app/main.py` | **MODIFY** | Register new `GET /workspace/files` and `/workspace/file` endpoints |
| `agent/app/state.py` | **NEW** | `V2AgentState` extending `CopilotKitState` |
| `agent/app/middleware/genui.py` | **NEW** | GenUI middleware — intercept tool calls, emit state |
| `agent/app/middleware/__init__.py` | **NEW** | Package init for middleware directory |
| `agent/pyproject.toml` | **MODIFY** | Verify copilotkit Python SDK version compatibility for `copilotkit_emit_state` |

### Frontend (web/src/)

| File | Change | Purpose |
|------|--------|---------|
| `app/page.tsx` | **MODIFY** | Add `SubAgentProgress` component, integrate `useCoAgentStateRender` |
| `components/SubAgentProgress.tsx` | **NEW** | Phase indicator + expandable subagent details |
| `components/DiffViewer.tsx` | **NEW** | File diff renderer (P0 GenUI) |
| `components/DataChart.tsx` | **NEW** | Tabular data + chart renderer (P1 GenUI) |
| `components/FileBrowser.tsx` | **NEW** | Workspace directory tree + file preview |
| `components/FileViewDialog.tsx` | **MODIFY** | Accept workspace file paths (not just agent-created files) |

### Docs

| File | Change | Purpose |
|------|--------|---------|
| `docs/superpowers/plans/2026-06-25-deepagents-v2-implementation.md` | **NEW** | Implementation plan with tasks |

## Non-Goals (V2)

- MCP server integration — postponed to V3
- Windows desktop shell — postponed
- Plugin marketplace — postponed
- Multi-agent user-facing orchestration (subagents are internal to the coordinator)
- Cloud sync or team collaboration

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Coordinator subagent delegation may increase latency | Subagents run sequentially (plan→do→review). Frontend shows real-time progress so user sees activity, not a blank loading state |
| GenUI middleware adds Python dependency complexity | Middleware is a single file (`genui.py`). The `copilotkit_emit_state` function is already part of the installed `copilotkit` Python package |
| File browser endpoint duplicates existing tool logic | Endpoints wrap the existing `list_workspace` / `read_text_file` tools. No duplication of business logic |
| User confusion from subagent details | Aggregated mode by default. Details are hidden behind an expand/collapse toggle. Beginner sees one clean response |
| `useCoAgentStateRender` hook availability | Must verify that the installed `@copilotkit/react-core` version exports this hook. Fallback: poll agent state via `useAgent().state` |
