import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProviderRegistryEditor } from "../ProviderRegistryEditor";

describe("ProviderRegistryEditor", () => {
  it("renders provider and model rows for registry-backed runtime settings", () => {
    const html = renderToStaticMarkup(
      <ProviderRegistryEditor
        providerProfiles={[
          {
            id: "lab-gateway",
            label: "Lab Gateway",
            protocol: "openai-compatible",
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
        onProviderChange={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    expect(html).toContain("Lab Gateway");
    expect(html).toContain("openai-compatible");
    expect(html).toContain("gpt-5.4");
    expect(html).toContain("Configured");
  });
});
