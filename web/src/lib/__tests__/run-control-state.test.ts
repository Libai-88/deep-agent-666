import { describe, expect, it } from "vitest";

import { resolveRunControlState } from "../run-control-state";

describe("run-control-state", () => {
  it("exposes stop while a run is active", () => {
    const state = resolveRunControlState({
      threadId: "thread-1",
      runStatus: "running",
      currentStep: "Writing code",
      activeProviderId: "lab-gateway",
      activeModelId: "lab-gpt5",
      recoverableError: null,
      lastRecoverablePrompt: "fix the bug",
    });

    expect(state.availableActions).toContain("stop");
    expect(state.status).toBe("running");
  });

  it("exposes resume and edit_plan when paused for approval", () => {
    const state = resolveRunControlState({
      threadId: "thread-1",
      runStatus: "waiting_approval",
      currentStep: "Planner review",
      activeProviderId: "openai",
      activeModelId: "openai-default",
      recoverableError: null,
      lastRecoverablePrompt: "review the plan",
    });

    expect(state.availableActions).toEqual(
      expect.arrayContaining(["resume", "edit_plan"]),
    );
    expect(state.pendingApproval).toBe(true);
  });
});
