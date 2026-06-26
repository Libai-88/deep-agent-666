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
});
