import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanEditorPanel } from "../PlanEditorPanel";

describe("PlanEditorPanel", () => {
  it("returns null when phase is not interrupted", () => {
    const html = renderToStaticMarkup(
      <PlanEditorPanel
        snapshot={{
          phase: "running",
          reason: "none",
          currentStep: "Working",
          statusMessage: "Running",
          availableActions: ["request_stop"],
          interruptPayload: null,
          threadId: "thread-1",
          runId: null,
          activeProviderId: null,
          activeModelId: null,
        }}
        draftPlan="some plan"
        onDraftPlanChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });

  it("renders plan editor when interrupted with plan_approval reason", () => {
    const html = renderToStaticMarkup(
      <PlanEditorPanel
        snapshot={{
          phase: "interrupted",
          reason: "plan_approval",
          currentStep: "Reviewing plan",
          statusMessage: "Please review the plan before proceeding",
          availableActions: ["approve_plan", "edit_plan"],
          interruptPayload: null,
          threadId: "thread-1",
          runId: "run-1",
          activeProviderId: "lab-gateway",
          activeModelId: "lab-gpt5",
        }}
        draftPlan="1. Inspect docs\n2. Update provider mapping"
        onDraftPlanChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("Review and edit plan");
    expect(html).toContain("Please review the plan before proceeding");
    expect(html).toContain("Update provider mapping");
    expect(html).toContain("Approve plan");
    expect(html).toContain("Apply edited plan");
  });
});
