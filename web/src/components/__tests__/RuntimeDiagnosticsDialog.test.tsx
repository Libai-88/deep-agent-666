import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RuntimeDiagnosticsPanel,
  RuntimeStatusBadge,
} from "../RuntimeDiagnosticsDialog";

describe("RuntimeDiagnosticsDialog", () => {
  it("renders degraded runtime details and provider state", () => {
    const html = renderToStaticMarkup(
      <RuntimeDiagnosticsPanel
        diagnostics={{
          status: "degraded",
          backendReachable: false,
          catalogSource: "fallback",
          launchablePresetCount: 1,
          configuredProviderCount: 1,
          workspaceRoot: "D:\\AgentBuild",
          checkedAt: "2026-06-27T00:00:00.000Z",
          providers: {
            openai: {
              configured: true,
              baseUrl: "https://api.openai.com/v1",
            },
            anthropic: {
              configured: false,
              baseUrl: null,
            },
            google: {
              configured: false,
              baseUrl: null,
            },
          },
        }}
      />,
    );

    expect(html).toContain("Degraded");
    expect(html).toContain("Fallback cache");
    expect(html).toContain("D:\\AgentBuild");
    expect(html).toContain("Configured");
  });

  it("renders a clickable status badge label", () => {
    const html = renderToStaticMarkup(
      <RuntimeStatusBadge status="offline" onClick={() => {}} />,
    );

    expect(html).toContain("Offline");
  });
});
