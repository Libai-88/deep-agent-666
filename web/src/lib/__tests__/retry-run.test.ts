import { describe, expect, it } from "vitest";

import {
  extractLatestAssistantText,
  extractLatestUserPrompt,
  resolvePendingRunPrompt,
} from "../retry-run";

describe("retry-run", () => {
  it("extracts the latest user prompt from mixed message history", () => {
    expect(
      extractLatestUserPrompt([
        { role: "assistant", content: "Earlier answer" },
        { role: "user", content: ["Inspect", "SUMMARY.md"] },
      ]),
    ).toBe("Inspect SUMMARY.md");
  });

  it("returns null when no user prompt is available", () => {
    expect(
      extractLatestUserPrompt([{ role: "assistant", content: "Only assistant" }]),
    ).toBeNull();
  });

  it("extracts the latest assistant text from mixed message history", () => {
    expect(
      extractLatestAssistantText([
        { role: "assistant", content: "Earlier answer" },
        { role: "assistant", content: ["Recovered", "summary"] },
      ]),
    ).toBe("Recovered summary");
  });

  it("extracts assistant text from structured content payloads", () => {
    expect(
      extractLatestAssistantText([
        {
          role: "assistant",
          content: [
            { text: "Coordinator replay completed after reconnect." },
          ],
        },
      ]),
    ).toBe("Coordinator replay completed after reconnect.");
  });

  it("does not inject a duplicate prompt when the latest user message already matches", () => {
    expect(
      resolvePendingRunPrompt({
        requestedPrompt: "Inspect SUMMARY.md",
        latestUserPrompt: "Inspect SUMMARY.md",
      }),
    ).toBeNull();
  });

  it("returns the requested prompt when recovery needs to replay it", () => {
    expect(
      resolvePendingRunPrompt({
        requestedPrompt: "Inspect SUMMARY.md",
        latestUserPrompt: null,
      }),
    ).toBe("Inspect SUMMARY.md");
  });
});
