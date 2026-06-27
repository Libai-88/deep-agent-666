import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RunControlBar } from "../RunControlBar";

describe("RunControlBar", () => {
  it("renders active provider/model and stop action", () => {
    const html = renderToStaticMarkup(
      <RunControlBar
        state={{
          threadId: "thread-1",
          runId: "run-1",
          status: "running",
          currentStep: "Writing code",
          availableActions: ["stop"],
          pendingApproval: false,
          lastRecoverablePrompt: "fix the bug",
          activeProviderId: "lab-gateway",
          activeModelId: "lab-gpt5",
        }}
        onAction={vi.fn()}
      />,
    );

    expect(html).toContain("Writing code");
    expect(html).toContain("lab-gateway");
    expect(html).toContain("lab-gpt5");
    expect(html).toContain("Stop");
  });
});
