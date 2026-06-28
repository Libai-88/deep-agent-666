import { describe, expect, it } from "vitest";

import { resolveRunControlState } from "../run-control-state";

describe("run-control-state", () => {
  it("returns idle status when snapshot is null", () => {
    const state = resolveRunControlState({
      threadId: "thread-1",
      runtimeControl: null,
      activeProviderId: "lab-gateway",
      activeModelId: "lab-gpt5",
    });

    expect(state.status).toBe("idle");
    expect(state.availableActions).toEqual([]);
    expect(state.pendingApproval).toBe(false);
  });

  it("returns pending approval and correct actions for interrupted plan_approval", () => {
    const state = resolveRunControlState({
      threadId: "thread-1",
      runtimeControl: {
        phase: "interrupted",
        reason: "plan_approval",
        currentStep: "Reviewing plan",
        statusMessage: "Approval needed",
        availableActions: ["approve_plan", "edit_plan"],
        interruptPayload: null,
        threadId: "thread-1",
        runId: "run-1",
        activeProviderId: "lab-gateway",
        activeModelId: "lab-gpt5",
      },
      activeProviderId: null,
      activeModelId: null,
    });

    expect(state.pendingApproval).toBe(true);
    expect(state.availableActions).toEqual(["approve_plan", "edit_plan"]);
    expect(state.status).toBe("interrupted");
  });

  it("returns running status and stop action when snapshot indicates running", () => {
    const state = resolveRunControlState({
      threadId: "thread-1",
      runtimeControl: {
        phase: "running",
        reason: "none",
        currentStep: "Writing code",
        statusMessage: "Running",
        availableActions: ["request_stop"],
        interruptPayload: null,
        threadId: "thread-1",
        runId: "run-1",
        activeProviderId: "lab-gateway",
        activeModelId: "lab-gpt5",
      },
      activeProviderId: null,
      activeModelId: null,
    });

    expect(state.status).toBe("running");
    expect(state.availableActions).toContain("request_stop");
    expect(state.pendingApproval).toBe(false);
  });
});
