import { describe, expect, it } from "vitest";

import {
  deriveThreadTitle,
  resolveNextThreadIdAfterDelete,
  sortThreadsByUpdatedAt,
  type LocalThread,
} from "../thread-registry";

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

  it("sorts threads by most recently updated first", () => {
    const threads: LocalThread[] = [
      {
        id: "thread-oldest",
        title: "Oldest",
        presetId: "openai-balanced",
        updatedAt: 1,
      },
      {
        id: "thread-newest",
        title: "Newest",
        presetId: "openai-balanced",
        updatedAt: 3,
      },
      {
        id: "thread-middle",
        title: "Middle",
        presetId: "openai-balanced",
        updatedAt: 2,
      },
    ];

    expect(sortThreadsByUpdatedAt(threads).map((thread) => thread.id)).toEqual([
      "thread-newest",
      "thread-middle",
      "thread-oldest",
    ]);
  });

  it("resolves the next active thread after deleting the current one", () => {
    const remainingThreads: LocalThread[] = [
      {
        id: "thread-middle",
        title: "Middle",
        presetId: "openai-balanced",
        updatedAt: 2,
      },
      {
        id: "thread-newest",
        title: "Newest",
        presetId: "openai-balanced",
        updatedAt: 3,
      },
    ];

    expect(
      resolveNextThreadIdAfterDelete({
        deletedThreadId: "thread-oldest",
        activeThreadId: "thread-oldest",
        remainingThreads,
      }),
    ).toBe("thread-newest");

    expect(
      resolveNextThreadIdAfterDelete({
        deletedThreadId: "thread-middle",
        activeThreadId: "thread-newest",
        remainingThreads: [
          {
            id: "thread-newest",
            title: "Newest",
            presetId: "openai-balanced",
            updatedAt: 3,
          },
        ],
      }),
    ).toBe("thread-newest");

    expect(
      resolveNextThreadIdAfterDelete({
        deletedThreadId: "thread-newest",
        activeThreadId: "thread-newest",
        remainingThreads: [],
      }),
    ).toBeNull();
  });
});
