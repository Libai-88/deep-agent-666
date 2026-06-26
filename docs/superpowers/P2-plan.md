# Deep Agent 666 — Phase 2 Implementation

> Implementing supervisor+@tool+Command subagent delegation pattern
> Reference: `D:\AgentBuild\copilotkit-repo\showcase\integrations\langgraph-fastapi\src\agents\src\subagents.py`

---

## Task 2.1: Rewrite V2 coordinator as supervisor+@tool+Command

**Target file:** `agent/app/agent_factory.py`

Change `build_v2_coordinator()` from Deep Agents `subagents=[...]` pattern to the official LangGraph supervisor+@tool+Command pattern:

1. Replace `create_deep_agent` with `create_agent` from `langchain.agents`
2. Define `Delegation` TypedDict + `V2AgentState` with `delegations: Annotated[list, add]`
3. Create 3 `_invoke_sub_agent` wrappers (planner, executor, reviewer) as `@tool` functions
4. Each tool returns `Command(update={delegations: [...], messages: [ToolMessage]})`
5. Supervisor graph uses `CopilotKitMiddleware()` for state sync

## Task 2.2: Add Delegation test

**Target file:** `agent/tests/test_v2_delegation.py`

Test that:
- Delegation list can be appended via operator.add reducer
- Supervisor builds with all 3 sub-agent tools
- Tool invocation produces Command with correct update structure

## Task 2.3: Verify E2E

- Start backend + frontend
- Point CopilotChat at coordinator endpoint
- Send "analyze the project structure"
- Verify delegations appear in state

---

## Reference code structure

```python
# Updated build_v2_coordinator pattern

class Delegation(TypedDict):
    id: str
    sub_agent: Literal["planner", "executor", "reviewer"]
    task: str
    status: Literal["running", "completed", "failed"]
    result: str

class V2AgentState(CopilotKitState):
    delegations: Annotated[list[Delegation], add]

@tool
def planner_tool(task: str, runtime: ToolRuntime) -> Command:
    """Analyze task, break into steps, identify files to modify"""
    return _delegate("planner", _planner_agent, task, runtime.tool_call_id)

# ... same for executor_tool, reviewer_tool

graph = create_agent(
    model=llm,
    tools=[planner_tool, executor_tool, reviewer_tool],
    middleware=[CopilotKitMiddleware()],
    state_schema=V2AgentState,
    system_prompt="You are a supervisor agent...",
)
```
