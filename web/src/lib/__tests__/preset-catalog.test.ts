import { describe, expect, it } from "vitest";

import { normalizePresetCatalog } from "../preset-catalog";

describe("preset catalog", () => {
  it("keeps only known backend presets and resolves a safe default", () => {
    expect(
      normalizePresetCatalog({
        defaultPresetId: "anthropic-balanced",
        presets: [
          {
            id: "anthropic-balanced",
            label: "Anthropic / Balanced",
            permission_mode: "balanced",
          },
          {
            id: "made-up-preset",
            label: "Made up",
            permission_mode: "balanced",
          },
        ],
      }),
    ).toEqual({
      defaultPresetId: "anthropic-balanced",
      presets: [
        {
          id: "anthropic-balanced",
          label: "Anthropic / Balanced",
          provider: "anthropic",
          permissionMode: "balanced",
        },
      ],
    });
  });

  it("falls back to null default when the backend exposes no valid presets", () => {
    expect(
      normalizePresetCatalog({
        defaultPresetId: "openai-balanced",
        presets: [{ id: "unknown", label: "Unknown", permission_mode: "balanced" }],
      }),
    ).toEqual({
      defaultPresetId: null,
      presets: [],
    });
  });
});
