from app.state import CoordinatorState, Delegation


def test_delegation_typeddict():
    d: Delegation = {
        "id": "test-id",
        "sub_agent": "planner",
        "task": "analyze the codebase",
        "status": "running",
        "result": "",
    }
    assert d["id"] == "test-id"
    assert d["sub_agent"] == "planner"
    assert d["status"] == "running"


def test_coordinator_state_defaults():
    """CoordinatorState accepts delegation entries."""
    state: CoordinatorState = {"delegations": []}
    assert "delegations" in state
    assert state["delegations"] == []


def test_coordinator_state_appends_delegations():
    state: CoordinatorState = {"delegations": []}
    d1: Delegation = {
        "id": "1",
        "sub_agent": "planner",
        "task": "plan",
        "status": "running",
        "result": "",
    }
    d2: Delegation = {
        "id": "2",
        "sub_agent": "executor",
        "task": "execute",
        "status": "running",
        "result": "",
    }
    state["delegations"] = state["delegations"] + [d1]
    state["delegations"] = state["delegations"] + [d2]
    assert len(state["delegations"]) == 2
    assert state["delegations"][0]["sub_agent"] == "planner"
    assert state["delegations"][1]["sub_agent"] == "executor"
