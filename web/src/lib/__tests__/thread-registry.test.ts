import { describe, expect, it } from "vitest";

import { deriveThreadTitle } from "../thread-registry";

describe("thread-registry", () => {
  it("derives a concise thread title from the first user message", () => {
    expect(deriveThreadTitle("Research SUMMARY.md and write a short brief")).toBe(
      "Research SUMMARY.md and write a short brief",
    );
  });

  it("trims and truncates long thread titles", () => {
    expect(
      deriveThreadTitle(
        "   This is a very long user request that should be shortened for the thread list and cleaned up   ",
      ),
    ).toBe("This is a very long user request that should...");
  });
});
