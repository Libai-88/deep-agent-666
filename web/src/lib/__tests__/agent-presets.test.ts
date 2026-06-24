import { describe, expect, it } from "vitest";

import {
  ALL_AGENT_PRESETS,
  DEFAULT_AGENT_PRESET_ID,
  parsePresetId,
  resolveDefaultPresetId,
  resolvePresetId,
} from "../agent-presets";

describe("agent presets", () => {
  it("resolves model and permission pairs to preset ids", () => {
    expect(resolvePresetId("openai", "balanced")).toBe("openai-balanced");
    expect(resolvePresetId("anthropic", "read-only")).toBe(
      "anthropic-read-only",
    );
  });

  it("exposes every preset id expected by the backend", () => {
    expect(ALL_AGENT_PRESETS.map((preset) => preset.id)).toEqual([
      "openai-read-only",
      "openai-balanced",
      "openai-full-access",
      "anthropic-read-only",
      "anthropic-balanced",
      "anthropic-full-access",
      "google-read-only",
      "google-balanced",
      "google-full-access",
    ]);
  });

  it("uses the backend-aligned default preset id", () => {
    expect(DEFAULT_AGENT_PRESET_ID).toBe("openai-balanced");
  });

  it("parses preset ids into provider and permission mode pairs", () => {
    expect(parsePresetId("google-full-access")).toEqual({
      provider: "google",
      permissionMode: "full-access",
    });
  });

  it("falls back to the first available preset when the default is unavailable", () => {
    expect(
      resolveDefaultPresetId({
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "google-balanced",
            label: "Google / Balanced",
            provider: "google",
            permissionMode: "balanced",
          },
        ],
      }),
    ).toBe("google-balanced");
  });
});
