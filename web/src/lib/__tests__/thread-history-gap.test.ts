import { describe, expect, it } from "vitest";

import {
  hasRestorableThreadContext,
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
      }),
    ).toBe(true);
  });

  it("does not flag a history gap when runtime messages were restored", () => {
    expect(
      shouldFlagThreadHistoryGap({
        runtimeAvailability: "ready",
        hasRestorableContext: true,
        messageCount: 2,
      }),
    ).toBe(false);
  });
});
