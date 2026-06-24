import { describe, expect, it } from "vitest";

import {
  createLocalThread,
  loadThreads,
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
});
