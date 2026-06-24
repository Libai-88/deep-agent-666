import { describe, expect, it } from "vitest";

import {
  createLocalThread,
  loadThreads,
  sanitizeThreads,
  saveThreads,
} from "../thread-registry";

describe("thread registry", () => {
  it("persists preset-aware threads", () => {
    const storage = window.localStorage;
    storage.clear();

    const thread = createLocalThread("openai-balanced");

    saveThreads([thread], storage);

    expect(loadThreads(storage)).toEqual([thread]);
  });

  it("recovers to an empty list when local storage contains invalid json", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem("deep-agent-666.threads", "{not-json");

    expect(loadThreads(storage)).toEqual([]);
  });

  it("drops invalid stored thread shapes instead of returning unsafe data", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: "good-thread",
          title: "Safe thread",
          presetId: "openai-balanced",
          updatedAt: 123,
        },
        {
          id: 42,
          title: "Broken thread",
          presetId: "not-a-preset",
          updatedAt: "yesterday",
        },
      ]),
    );

    expect(loadThreads(storage)).toEqual([
      {
        id: "good-thread",
        title: "Safe thread",
        presetId: "openai-balanced",
        updatedAt: 123,
      },
    ]);
  });

  it("drops persisted threads whose presets are not currently available", () => {
    expect(
      sanitizeThreads(
        [
          {
            id: "thread-openai",
            title: "OpenAI thread",
            presetId: "openai-balanced",
            updatedAt: 1,
          },
          {
            id: "thread-google",
            title: "Google thread",
            presetId: "google-balanced",
            updatedAt: 2,
          },
        ],
        [
          {
            id: "google-balanced",
            label: "Google / Balanced",
            provider: "google",
            permissionMode: "balanced",
          },
        ],
      ),
    ).toEqual([
      {
        id: "thread-google",
        title: "Google thread",
        presetId: "google-balanced",
        updatedAt: 2,
      },
    ]);
  });
});
