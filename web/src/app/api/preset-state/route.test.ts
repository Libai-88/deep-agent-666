import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime-agents", () => ({
  loadRuntimeCatalog: vi.fn(),
}));

import { GET } from "./route";
import { loadRuntimeCatalog } from "@/lib/runtime-agents";

describe("preset-state route", () => {
  it("returns the normalized runtime preset state payload", async () => {
    vi.mocked(loadRuntimeCatalog).mockResolvedValue({
      source: "live",
      catalog: {
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      },
    });

    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      source: "live",
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          permissionMode: "balanced",
          provider: "openai",
        },
      ],
    });
  });
});
