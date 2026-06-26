import { describe, expect, it } from "vitest";

import { resolveThreadAgentId } from "../thread-agent";

describe("thread-agent", () => {
  it("uses the base preset for read-only threads", () => {
    expect(resolveThreadAgentId("openai-read-only", "read-only")).toBe(
      "openai-read-only",
    );
  });

  it("routes balanced and full-access threads through the coordinator", () => {
    expect(resolveThreadAgentId("openai-balanced", "balanced")).toBe(
      "coordinator-openai-balanced",
    );
    expect(resolveThreadAgentId("google-full-access", "full-access")).toBe(
      "coordinator-google-full-access",
    );
  });
});
