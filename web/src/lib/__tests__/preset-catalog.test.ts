import { describe, expect, it } from "vitest";

import { normalizePresetCatalog } from "../preset-catalog";

describe("preset catalog", () => {
  it("keeps structurally valid backend presets and resolves a safe default", () => {
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
        {
          id: "made-up-preset",
          label: "Made up",
          provider: "made-up-preset",
          permissionMode: "balanced",
        },
      ],
    });
  });

  it("falls back to null default when the backend exposes no presets with a valid permission mode", () => {
    expect(
      normalizePresetCatalog({
        defaultPresetId: "openai-balanced",
        presets: [{ id: "unknown", label: "Unknown" }],
      }),
    ).toEqual({
      defaultPresetId: null,
      presets: [],
    });
  });

  it("keeps custom provider presets from the backend registry", () => {
    expect(
      normalizePresetCatalog({
        defaultPresetId: "lab-gateway-balanced",
        presets: [
          {
            id: "lab-gateway-balanced",
            label: "Lab Gateway / Balanced",
            permission_mode: "balanced",
            provider_id: "lab-gateway",
          },
        ],
      }),
    ).toEqual({
      defaultPresetId: "lab-gateway-balanced",
      presets: [
        {
          id: "lab-gateway-balanced",
          label: "Lab Gateway / Balanced",
          provider: "lab-gateway",
          permissionMode: "balanced",
        },
      ],
    });
  });
});
