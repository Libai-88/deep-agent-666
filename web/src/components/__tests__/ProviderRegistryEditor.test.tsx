import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProviderRegistryEditor } from "../ProviderRegistryEditor";

describe("ProviderRegistryEditor", () => {
  it("renders provider and model rows for registry-backed runtime settings", () => {
    const html = renderToStaticMarkup(
      <ProviderRegistryEditor
        apiKeys={{
          "lab-gateway": "secret",
        }}
        providerProfiles={[
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
            authScheme: "bearer_token",
            baseUrl: "https://gateway.example.com/v1",
            apiKeyPresent: true,
            enabled: true,
            headers: {
              "X-Team": "chem",
            },
          },
        ]}
        modelProfiles={[
          {
            id: "lab-gpt5",
            providerId: "lab-gateway",
            modelName: "gpt-5.4",
            label: "GPT 5.4",
            capabilities: ["chat", "tools"],
            isDefault: true,
            enabled: true,
          },
        ]}
        probeState={{
          "lab-gateway": {
            status: "ready",
            message: "ok",
            checkedAt: "2026-06-28T00:00:00.000Z",
          },
        }}
        onProbe={vi.fn()}
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
        onApiKeyChange={vi.fn()}
      />,
    );

    expect(html).toContain("Lab Gateway");
    expect(html).toContain("openai-compatible");
    expect(html).toContain("gpt-5.4");
    expect(html).toContain("Configured");
    expect(html).toContain("Add provider");
    expect(html).toContain("Provider label");
    expect(html).toContain("API key");
    expect(html).toContain("Model name");
    expect(html).toContain("Authentication");
    expect(html).toContain("Headers");
    expect(html).toContain("Default model");
    expect(html).toContain("Test connection");
    expect(html).toContain("Ready");
  });
});
