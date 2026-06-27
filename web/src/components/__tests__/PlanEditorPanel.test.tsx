import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PlanEditorPanel } from "../PlanEditorPanel";

describe("PlanEditorPanel", () => {
  it("renders paused run actions with an editable plan surface", () => {
    const html = renderToStaticMarkup(
      <PlanEditorPanel
        open
        currentStep="Planner review"
        draftPlan={`1. Inspect docs\n2. Update provider mapping`}
        onDraftPlanChange={vi.fn()}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("Edit plan");
    expect(html).toContain("Planner review");
    expect(html).toContain("Update provider mapping");
    expect(html).toContain("Apply plan");
  });
});
