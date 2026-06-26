import { describe, expect, it } from "vitest";

import {
  hasRestorableThreadContext,
  restoredMessagesIncludePrompt,
  shouldFlagThreadHistoryGap,
} from "../thread-history-gap";
import { createEmptyWorkbenchState } from "../workbench-state";

describe("thread-history-gap", () => {
  it("treats a stored replay prompt as restorable thread context", () => {
    expect(
      hasRestorableThreadContext({
        ...createEmptyWorkbenchState(),
        lastUserPrompt: "Inspect SUMMARY.md",
      }),
    ).toBe(true);
  });

  it("does not treat a truly empty thread as recoverable history", () => {
    expect(hasRestorableThreadContext(createEmptyWorkbenchState())).toBe(false);
  });

  it("flags a thread history gap only when runtime is reachable and no messages were restored", () => {
    expect(
      shouldFlagThreadHistoryGap({
        runtimeAvailability: "ready",
        hasRestorableContext: true,
        messageCount: 0,
        lastUserPrompt: "Inspect SUMMARY.md",
        restoredPromptPresent: false,
      }),
    ).toBe(true);
  });

  it("does not flag a history gap when runtime messages were restored", () => {
    expect(
      shouldFlagThreadHistoryGap({
        runtimeAvailability: "ready",
        hasRestorableContext: true,
        messageCount: 2,
        lastUserPrompt: "Inspect SUMMARY.md",
        restoredPromptPresent: true,
      }),
    ).toBe(false);
  });

  it("finds the stored last prompt inside restored runtime messages", () => {
    expect(
      restoredMessagesIncludePrompt(
        [
          { role: "assistant", content: "Older answer" },
          { role: "user", content: ["Inspect", "SUMMARY.md"] },
        ],
        "Inspect SUMMARY.md",
      ),
    ).toBe(true);
  });

  it("flags partial-history drift when the latest local prompt is missing from restored messages", () => {
    expect(
      shouldFlagThreadHistoryGap({
        runtimeAvailability: "ready",
        hasRestorableContext: true,
        messageCount: 2,
        lastUserPrompt: "Latest local task",
        restoredPromptPresent: false,
      }),
    ).toBe(true);
  });
});
