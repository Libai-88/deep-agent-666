import { describe, expect, it } from "vitest";

import { buildRemoteAgentUrl } from "../copilot-runtime";

describe("copilot runtime helpers", () => {
  it("builds preset-specific backend urls", () => {
    expect(
      buildRemoteAgentUrl("http://127.0.0.1:8123", "openai-balanced"),
    ).toBe("http://127.0.0.1:8123/openai-balanced");
  });

  it("normalizes a trailing slash on the backend base url", () => {
    expect(
      buildRemoteAgentUrl("http://127.0.0.1:8123/", "google-full-access"),
    ).toBe("http://127.0.0.1:8123/google-full-access");
  });
});
