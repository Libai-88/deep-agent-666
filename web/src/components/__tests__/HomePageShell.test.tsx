import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HomePageShell } from "../HomePageShell";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

describe("HomePageShell", () => {
  it("renders the starter template panel when presets are ready but no thread is active", () => {
    const html = renderToStaticMarkup(
      <HomePageShell
        state="ready-no-thread"
        starterTemplates={STARTER_TEMPLATES}
        gateTitle=""
        gateDescription=""
        gateActions={[]}
        onGateAction={() => {}}
        onStarterSelect={vi.fn()}
      >
        <div>Workbench</div>
      </HomePageShell>,
    );

    expect(html).toContain("Start with a guided task");
    expect(html).toContain("Analyze the repository structure");
  });

  it("renders the first-run gate for recoverable onboarding errors", () => {
    const html = renderToStaticMarkup(
      <HomePageShell
        state="recoverable-error"
        starterTemplates={STARTER_TEMPLATES}
        gateTitle="Backend unavailable"
        gateDescription="The agent backend could not be reached."
        gateActions={[{ label: "Retry connection", action: "retry_connection" }]}
        onGateAction={() => {}}
        onStarterSelect={vi.fn()}
      >
        <div>Workbench</div>
      </HomePageShell>,
    );

    expect(html).toContain("Backend unavailable");
    expect(html).toContain("Retry connection");
  });
});
