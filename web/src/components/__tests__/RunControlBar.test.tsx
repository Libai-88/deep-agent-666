import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RunControlBar } from "../RunControlBar";

describe("RunControlBar", () => {
  it("renders request_stop as Stop button with provider info", () => {
    const html = renderToStaticMarkup(
      <RunControlBar
        state={{
          threadId: "thread-1",
          runId: "run-1",
          status: "running",
          currentStep: "Writing code",
          availableActions: ["request_stop"],
          pendingApproval: false,
          activeProviderId: "lab-gateway",
          activeModelId: "lab-gpt5",
        }}
        onAction={vi.fn()}
      />,
    );

    expect(html).toContain("Stop");
    expect(html).toContain("Writing code");
    expect(html).toContain("lab-gateway");
    expect(html).toContain("lab-gpt5");
  });

  it("renders approve_plan and edit_plan buttons", () => {
    const html = renderToStaticMarkup(
      <RunControlBar
        state={{
          threadId: "thread-1",
          runId: null,
          status: "interrupted",
          currentStep: "Plan approval",
          availableActions: ["approve_plan", "edit_plan"],
          pendingApproval: true,
          activeProviderId: null,
          activeModelId: null,
        }}
        onAction={vi.fn()}
      />,
    );

    expect(html).toContain("Approve plan");
    expect(html).toContain("Edit plan");
  });

  it("does not render any action buttons when list is empty", () => {
    const html = renderToStaticMarkup(
      <RunControlBar
        state={{
          threadId: "thread-1",
          runId: null,
          status: "idle",
          currentStep: null,
          availableActions: [],
          pendingApproval: false,
          activeProviderId: null,
          activeModelId: null,
        }}
        onAction={vi.fn()}
      />,
    );

    expect(html).not.toContain("Stop");
    expect(html).not.toContain("Approve plan");
    expect(html).not.toContain("Edit plan");
    expect(html).not.toContain("Retry");
  });
});
