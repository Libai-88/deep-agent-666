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
          registryProviders: [
            {
              id: "lab-gateway",
              label: "Lab Gateway",
              protocol: "openai-compatible",
              authScheme: "bearer_token",
              baseUrl: "https://gateway.example.com/v1",
              enabled: true,
              apiKeyPresent: true,
              modelCount: 1,
              defaultModel: "GPT 5.4",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Degraded");
    expect(html).toContain("Fallback cache");
    expect(html).toContain("D:\\AgentBuild");
    expect(html).toContain("Configured");
    expect(html).toContain("Registry Providers");
    expect(html).toContain("Lab Gateway");
    expect(html).toContain("Default model: GPT 5.4");
  });

  it("renders a clickable status badge label", () => {
    const html = renderToStaticMarkup(
      <RuntimeStatusBadge status="offline" onClick={() => {}} />,
    );

    expect(html).toContain("Offline");
  });
});
