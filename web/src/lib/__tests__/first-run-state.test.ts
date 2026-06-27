import { describe, expect, it } from "vitest";

import { resolveFirstRunState } from "../first-run-state";

describe("first-run-state", () => {
  it("returns unconfigured when no presets are available after checking", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: { defaultPresetId: null, presets: [] },
        catalogSource: "fallback",
        threads: [],
        activeThreadId: null,
        recoverableError: null,
      }),
    ).toBe("unconfigured");
  });

  it("returns ready-no-thread when presets exist but no thread is active", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: {
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              provider: "openai",
              permissionMode: "balanced",
            },
          ],
        },
        catalogSource: "live",
        threads: [],
        activeThreadId: null,
        recoverableError: null,
      }),
    ).toBe("ready-no-thread");
  });

  it("returns recoverable-error when a runtime failure is present", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: {
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              provider: "openai",
              permissionMode: "balanced",
            },
          ],
        },
        catalogSource: "live",
        threads: [],
        activeThreadId: null,
        recoverableError: "runtime_request_failed",
      }),
    ).toBe("recoverable-error");
  });

  it("keeps the active thread shell when a recoverable runtime failure happens in-thread", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: { defaultPresetId: null, presets: [] },
        catalogSource: "fallback",
        threads: [
          {
            id: "thread-1",
            title: "Recovery thread",
            presetId: "openai-balanced",
            updatedAt: 1,
          },
        ],
        activeThreadId: "thread-1",
        recoverableError: "backend_unreachable",
      }),
    ).toBe("ready-active-thread");
  });

  it("still falls back to the gate when the active thread itself is invalid", () => {
    expect(
      resolveFirstRunState({
        isChecking: false,
        catalog: {
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              provider: "openai",
              permissionMode: "balanced",
            },
          ],
        },
        catalogSource: "live",
        threads: [
          {
            id: "thread-1",
            title: "Invalid thread",
            presetId: "openai-balanced",
            updatedAt: 1,
          },
        ],
        activeThreadId: "thread-1",
        recoverableError: "thread_missing_or_invalid",
      }),
    ).toBe("recoverable-error");
  });
});
