import { describe, expect, it } from "vitest";

import {
  resolveRecoverableActions,
  resolveRecoverableErrorCode,
} from "../runtime-errors";

describe("runtime-errors", () => {
  it("maps backend_unreachable to retry and settings actions", () => {
    expect(resolveRecoverableActions("backend_unreachable")).toEqual([
      { label: "Retry connection", action: "retry_connection" },
      { label: "Open settings", action: "open_settings" },
    ]);
  });

  it("classifies upstream rate limit failures as recoverable provider quota errors", () => {
    expect(
      resolveRecoverableErrorCode({
        error: new Error(
          "429 Rate limit exceeded: free-models-per-day for the current provider key",
        ),
      }),
    ).toBe("provider_rate_limited");
  });

  it("classifies invalid model failures as provider model configuration errors", () => {
    expect(
      resolveRecoverableErrorCode({
        error: new Error(
          "Model not found: openrouter/free is not a valid model for this base URL",
        ),
      }),
    ).toBe("provider_model_unavailable");
  });

  it("offers settings recovery for provider quota errors", () => {
    expect(resolveRecoverableActions("provider_rate_limited")).toEqual([
      { label: "Open settings", action: "open_settings" },
      { label: "Retry last task", action: "retry_last_task" },
    ]);
  });

  it("does not misclassify missing agent errors as provider model failures", () => {
    expect(
      resolveRecoverableErrorCode({
        error: new Error(
          "HTTP 404: {\"error\":\"Agent not found\",\"message\":\"Agent 'coordinator-openai-balanced' does not exist\"}",
        ),
      }),
    ).toBe("runtime_request_failed");
  });
});
