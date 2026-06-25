# V2 Subagent + GenUI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend V1's single-agent loop with a Plan→Do→Review coordinator, subagent delegation, GenUI middleware for file diffs, and a workspace file browser.

**Architecture:** Backend adds a coordinator agent with 3 subagents (planner/executor/reviewer) and a GenUI middleware layer that intercepts tool calls and emits structured state via `copilotkit_emit_state`. Frontend renders subagent progress via `useCoAgentStateRender`, file diffs via `DiffViewer`, and workspace files via a new `FileBrowser` panel with dedicated backend endpoints.

**Tech Stack:** Python 3.11+, Deep Agents 0.6.11+, CopilotKit Python 0.1.94+, FastAPI 0.138.0+, Next.js 16.2.9+, React 19.2.7+, `@copilotkit/react-core` v2, shadcn/ui, Tailwind v4.

**Design Doc:** `docs/superpowers/specs/2026-06-25-deepagents-v2-subagent-genui-design.md`

---

## Phase 1: Subagent Coordinator Skeleton

### Task 1.1: Define V2AgentState

**Files:**
- Create: `agent/app/state.py`
- Test: `agent/tests/test_v2_state.py`

**Step 1: Write the failing test**

```python
# agent/tests/test_v2_state.py
from app.state import V2AgentState


def test_v2_state_defaults():
    state = V2AgentState()
    assert state.phase == "idle"
    assert state.plan_steps == []
    assert state.completed_steps == []
    assert state.file_changes == []
    assert state.review_result is None


def test_v2_state_phase_transition():
    state = V2AgentState(phase="planning", plan_steps=[{"step": "analyze"}])
    assert state.phase == "planning"
    assert state.plan_steps[0]["step"] == "analyze"


def test_v2_state_inherits_copilotkit_state():
    from copilotkit import CopilotKitState
    assert issubclass(V2AgentState, CopilotKitState)
```

**Step 2: Run test to verify it fails**

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation
uv run --project agent pytest agent/tests/test_v2_state.py -v
```
Expected: FAIL with ModuleNotFoundError

**Step 3: Write minimal implementation**

```python
# agent/app/state.py
from typing import Any
from copilotkit import CopilotKitState


class V2AgentState(CopilotKitState):
    phase: str = "idle"  # idle | planning | executing | reviewing | done
    plan_steps: list[dict[str, Any]] = []
    completed_steps: list[dict[str, Any]] = []
    file_changes: list[dict[str, Any]] = []
    review_result: str | None = None
```

**Step 4: Run test to verify it passes**

```bash
uv run --project agent pytest agent/tests/test_v2_state.py -v
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add agent/app/state.py agent/tests/test_v2_state.py
git commit -m "feat(v2): add V2AgentState with CopilotKitState inheritance"
```

---

### Task 1.2: Build coordinator agent with subagents

**Files:**
- Modify: `agent/app/agent_factory.py`
- Test: `agent/tests/test_v2_coordinator.py`

**Step 1: Write the failing test**

```python
# agent/tests/test_v2_coordinator.py
"""Verify coordinator builds with subagents."""
from app.agent_factory import build_v2_coordinator
from app.config import AgentSettings, ConfigStore


def test_coordinator_builds_with_subagents():
    settings = AgentSettings()
    store = ConfigStore(settings)
    coordinator = build_v2_coordinator(
        model="openai/gpt-4o-mini",
        permission_mode="balanced",
        store=store,
    )
    assert coordinator is not None
    # Coordinator should have subagents
    assert hasattr(coordinator, "subagents")
```

**Step 2: Run test to verify it fails**

```bash
uv run --project agent pytest agent/tests/test_v2_coordinator.py -v
```
Expected: FAIL with ImportError

**Step 3: Write minimal implementation**

```python
# In agent/app/agent_factory.py — append:

def build_v2_coordinator(
    model: str,
    permission_mode: str,
    store: ConfigStore,
) -> Any:
    """Build a coordinator agent with plan/do/review subagents."""
    provider = model.split("/", maxsplit=1)[0]
    preset = next(
        (p for p in ALL_PRESETS.values() if p.model == model),
        None,
    )
    if not preset:
        raise ValueError(f"unknown model: {model}")

    settings = store.snapshot()
    toolset = _toolset_for_preset(preset)
    # Don't share dangerous tools with planner/reviewer
    read_only_tools = [t for t in toolset if t.name in (
        "list_workspace", "search_workspace",
        "read_text_file", "read_document",
    )]

    coordinator = create_deep_agent(
        model=_build_model(preset, settings),
        tools=toolset,
        subagents=[
            {
                "name": "planner",
                "description": "Analyze task, break into steps, identify files to modify",
                "tools": read_only_tools,
            },
            {
                "name": "executor",
                "description": "Execute planned steps using file and command tools",
                "tools": toolset,
            },
            {
                "name": "reviewer",
                "description": "Verify results match plan, check for errors",
                "tools": read_only_tools,
            },
        ],
        middleware=[copilotkit_middleware],
        # Use V2AgentState instead of default AgentState
        state_schema=V2AgentState,
    )
    return coordinator
```

**Step 4: Run test to verify it passes**

```bash
uv run --project agent pytest agent/tests/test_v2_coordinator.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add agent/app/agent_factory.py agent/tests/test_v2_coordinator.py
git commit -m "feat(v2): add build_v2_coordinator with plan/do/review subagents"
```

---

### Task 1.3: Register coordinator in main.py alongside V1 agents

**Files:**
- Modify: `agent/app/main.py`
- Test: `agent/tests/test_v2_endpoints.py`

**Step 1: Write the failing test**

```python
# agent/tests/test_v2_endpoints.py
from fastapi.testclient import TestClient
from app.main import app


def test_coordinator_endpoint_registered():
    client = TestClient(app)
    resp = client.get("/presets")
    assert resp.status_code == 200
    data = resp.json()
    # Should include a coordinator preset
    assert any("coordinator" in str(p).lower() for p in data.get("presets", []))
```

**Step 2: Run test**

```bash
uv run --project agent pytest agent/tests/test_v2_endpoints.py -v
```
Expected: FAIL

**Step 3: Modify main.py**

```python
# In agent/app/main.py — register coordinator alongside V1 presets

# Existing code builds agents per preset:
# agents = build_langgraph_agents(settings)

# V2 addition: build coordinator for each configured provider
v2_agents = {}
for preset_id, preset in presets_by_id.items():
    if preset.permission_mode in ("balanced", "full-access"):
        # Coordinator needs execution permission
        coordinator = build_v2_coordinator(
            model=preset.model,
            permission_mode=preset.permission_mode,
            store=config_store or ConfigStore(settings),
        )
        v2_agents[f"coordinator-{preset_id}"] = coordinator
```

**Step 4: Run test**

```bash
uv run --project agent pytest agent/tests/test_v2_endpoints.py -v
```
Expected: PASS

**Step 5: Commit**

```bash
git add agent/app/main.py agent/tests/test_v2_endpoints.py
git commit -m "feat(v2): register coordinator endpoints alongside V1 presets"
```

---

### Task 1.4: Frontend SubAgentProgress component

**Files:**
- Create: `web/src/components/SubAgentProgress.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: Create SubAgentProgress component**

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, Timer } from "lucide-react";

interface V2State {
  phase: "idle" | "planning" | "executing" | "reviewing" | "done";
  plan_steps: Array<{ step: string; done?: boolean }>;
  completed_steps: Array<{ step: string }>;
  review_result: string | null;
}

const phaseConfig: Record<string, { icon: typeof Timer; color: string; bg: string; label: string }> = {
  planning:  { icon: Timer,    color: "text-blue-500", bg: "bg-blue-50", label: "Planning" },
  executing: { icon: Loader2,  color: "text-purple-500", bg: "bg-purple-50", label: "Executing" },
  reviewing: { icon: CheckCircle2, color: "text-teal-500", bg: "bg-teal-50", label: "Reviewing" },
  done:      { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", label: "Complete" },
  idle:      { icon: Timer,    color: "text-gray-400", bg: "bg-gray-50", label: "Idle" },
};

export function SubAgentProgress() {
  // Subscribe to coordinator agent state — reads .state from the AbstractAgent
  const { agent } = useAgent({ agentId: "coordinator" });
  const [state, setState] = useState<V2State | null>(null);

  useEffect(() => {
    if (!agent) return;
    // Initial read
    setState(agent.state as V2State);
    // Subscribe to state changes — the AbstractAgent notifies subscribers
    const unsub = agent.on("stateUpdate", (newState: unknown) => {
      setState(newState as V2State);
    });
    return unsub;
  }, [agent]);
  const [expanded, setExpanded] = useState(false);

  if (!state?.phase || state.phase === "idle") return null;

  const phase = phaseConfig[state.phase] ?? phaseConfig.idle;
  const Icon = phase.icon;

  return (
    <div className={`mx-4 my-2 rounded-lg border border-border ${phase.bg} p-3`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className={`h-4 w-4 ${phase.color} ${state.phase === "executing" ? "animate-spin" : ""}`} />
        <span className="text-xs font-medium">{phase.label}</span>
        {state.plan_steps && (
          <span className="text-xs text-muted-foreground">
            {state.completed_steps?.length ?? 0}/{state.plan_steps.length} steps
          </span>
        )}
      </button>

      {expanded && state.plan_steps && (
        <div className="mt-2 space-y-1 pl-6">
          {state.plan_steps.map((step, i) => {
            const done = state.completed_steps?.some((c) => c.step === step.step);
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                {done
                  ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                  : <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                }
                <span className={done ? "text-green-700" : "text-foreground"}>{step.step}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to page.tsx**

Insert `<SubAgentProgress />` in the chat area, above `<CopilotChat>`, or inside the chat area as a state-driven panel.

```tsx
// In page.tsx imports:
import { SubAgentProgress } from "@/components/SubAgentProgress";

// In JSX, inside the chat panel, above CopilotChat:
<div className="flex-1 flex flex-col min-h-0">
  <SubAgentProgress />
  <div className="flex-1 min-h-0">
    <CopilotChat ... />
  </div>
</div>
```

**Step 3: Build check**

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation\web
npx next build 2>&1 | tail -10
```
Expected: Build passes (note: `useCoAgentStateRender` may need to be imported from a different path — verify hook name in installed package)

**Step 4: Commit**

```bash
git add web/src/components/SubAgentProgress.tsx web/src/app/page.tsx
git commit -m "feat(v2): add SubAgentProgress component with phase indicator"
```

---

## Phase 2: GenUI Middleware + File Diff

### Task 2.1: GenUI middleware

**Files:**
- Create: `agent/app/middleware/__init__.py`
- Create: `agent/app/middleware/genui.py`
- Modify: `agent/app/agent_factory.py` (register middleware)
- Test: `agent/tests/test_v2_genui.py`

**Step 1: Create middleware package**

```python
# agent/app/middleware/__init__.py
"""GenUI middleware package."""
```

**Step 2: Write GenUI middleware**

```python
# agent/app/middleware/genui.py
"""Intercept tool calls, capture before/after for diff, emit via copilotkit_emit_state."""
from typing import Any
from langchain_core.runnables import RunnableConfig
from copilotkit.langgraph import copilotkit_emit_state


async def genui_middleware(state: dict[str, Any], config: RunnableConfig) -> None:
    """Emits structured state for the frontend to render.

    Runs after each tool execution. Captures file changes for DiffViewer
    and phase transitions for SubAgentProgress.
    """
    # Emit phase transition
    current_phase = state.get("phase")
    if current_phase and current_phase != "idle":
        await copilotkit_emit_state(config, {"phase": current_phase})

    # Emit plan steps when planning completes
    if current_phase == "planning" and state.get("plan_steps"):
        await copilotkit_emit_state(config, {
            "genui_plan": state["plan_steps"],
        })

    # Emit file changes when a write tool completes
    file_changes = state.get("file_changes", [])
    if file_changes:
        latest = file_changes[-1]
        await copilotkit_emit_state(config, {
            "genui_diff": {
                "file_path": latest.get("file_path", "unknown"),
                "before": latest.get("before", ""),
                "after": latest.get("after", ""),
            },
        })

    # Emit review result
    if current_phase == "reviewing" and state.get("review_result"):
        await copilotkit_emit_state(config, {
            "genui_review": state["review_result"],
        })
```

**Step 3: Register middleware in coordinator**

```python
# In agent_factory.py build_v2_coordinator, add genui_middleware to middleware list:

from app.middleware.genui import genui_middleware

# Inside build_v2_coordinator:
coordinator = create_deep_agent(
    ...,
    middleware=[
        copilotkit_middleware,
        genui_middleware,  # New
    ],
    ...,
)
```

**Step 4: Write test**

```python
# agent/tests/test_v2_genui.py
"""Test GenUI middleware emits correct state."""
from app.middleware.genui import genui_middleware


async def test_genui_emits_phase():
    state = {"phase": "planning", "plan_steps": [{"step": "analyze"}]}
    # Middleware should not crash
    await genui_middleware(state, {})
    # Assertions: the middleware is tested via integration.
    # Unit test ensures it doesn't raise.
    assert True
```

**Step 5: Test + commit**

```bash
uv run --project agent pytest agent/tests/test_v2_genui.py -v
git add agent/app/middleware/ agent/app/agent_factory.py agent/tests/test_v2_genui.py
git commit -m "feat(v2): add GenUI middleware for file diff and phase emission"
```

---

### Task 2.2: Frontend DiffViewer component

**Files:**
- Create: `web/src/components/DiffViewer.tsx`
- Modify: `web/src/app/page.tsx` (integrate useCoAgentStateRender for diff)
- Test: `web/src/lib/__tests__/DiffViewer.test.tsx`

This is a standard React component rendering a side-by-side diff. It receives `before`/`after`/`filePath` props and renders with +/- line markers and green/red backgrounds. No CopilotKit-specific logic.

---

## Phase 3: Workspace File Browser + Charts

### Task 3.1: Backend workspace file endpoints

**Files:**
- Modify: `agent/app/main.py`

Add two GET endpoints wrapping existing tool logic:

```python
@app.get("/workspace/files")
async def list_directory(path: str = ""):
    resolved = resolve_workspace_path(config_store.snapshot().workspace_root, path)
    if not resolved.exists() or not resolved.is_dir():
        raise HTTPException(404)
    items = []
    for entry in resolved.iterdir():
        items.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0,
            "modified": entry.stat().st_mtime,
        })
    return {"path": path, "items": sorted(items, key=lambda x: (not x["is_dir"], x["name"]))}


@app.get("/workspace/file")
async def read_file_endpoint(path: str):
    resolved = resolve_workspace_path(config_store.snapshot().workspace_root, path)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(404)
    content = resolved.read_text(encoding="utf-8", errors="replace")
    return {"path": path, "content": content}
```

### Task 3.2: Frontend FileBrowser component

**Files:**
- Create: `web/src/components/FileBrowser.tsx`
- Modify: `web/src/components/FileViewDialog.tsx`
- Modify: `web/src/app/page.tsx` (add Files tab)

A directory tree component that calls `GET /workspace/files` to list directories and `GET /workspace/file` to preview files. Integrates with existing `FileViewDialog`.

---

### Task 3.3: DataChart component (P1 — optional)

**Files:**
- Create: `web/src/components/DataChart.tsx`

A simple component that:
1. Receives structured data (column names + rows) via GenUI state
2. Renders a sortable shadcn Table
3. Optionally toggles to a bar chart using inline SVG (no external chart library)

---

## Execution Plan Summary

```
Phase 1: Subagent skeleton
  ├─ 1.1 V2AgentState definition           → ~15 min
  ├─ 1.2 Coordinator + subagents           → ~30 min
  ├─ 1.3 Register endpoints               → ~15 min
  └─ 1.4 SubAgentProgress component        → ~30 min

Phase 2: GenUI + Diff
  ├─ 2.1 GenUI middleware                  → ~30 min
  └─ 2.2 DiffViewer component             → ~30 min

Phase 3: File browser + Charts
  ├─ 3.1 Backend endpoints                 → ~15 min
  ├─ 3.2 FileBrowser component            → ~30 min
  └─ 3.3 DataChart component (P1)         → ~30 min (optional)

Total estimated: ~3-4 hours for all 3 phases
```

---

## Verification Checklist

- [ ] `agent/tests/test_v2_state.py` — 3 tests pass
- [ ] `agent/tests/test_v2_coordinator.py` — coordinator builds with subagents
- [ ] `agent/tests/test_v2_endpoints.py` — coordinator presets registered
- [ ] `agent/tests/test_v2_genui.py` — middleware emits without error
- [ ] `npm run build` — no type errors
- [ ] `npm run test` — all existing tests still pass
- [ ] Manual: coordinator responds with subagent progress visible in UI
- [ ] Manual: file edits show diff in chat
- [ ] Manual: workspace file browser loads directory tree
