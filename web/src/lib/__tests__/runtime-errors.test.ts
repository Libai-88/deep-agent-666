import { describe, expect, it } from "vitest";

import {
  resolveRecoverableActions,
  resolveRecoverableErrorCode,
} from "../runtime-errors";

describe("runtime-errors", () => {
  it("maps backend_unreachable to retry and settings actions", () => {
    expect(resolveRecoverableActions("backend_unreachable")).toEqual([
      { label: "Retry connection", action: "retry_connection" },
      { label: "View diagnostics", action: "view_diagnostics" },
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
      { label: "View diagnostics", action: "view_diagnostics" },
      { label: "Open settings", action: "open_settings" },
      { label: "Retry last task", action: "retry_last_task" },
    ]);
  });

  it("classifies invalid workspace-root saves as a dedicated recoverable error", () => {
    expect(
      resolveRecoverableErrorCode({
        code: "workspace_root_invalid",
        detail: "workspace root does not exist",
      }),
    ).toBe("workspace_root_invalid");
  });

  it("offers retry and fresh-thread recovery when runtime history is missing", () => {
    expect(resolveRecoverableActions("thread_history_unavailable")).toEqual([
      { label: "Retry last task", action: "retry_last_task" },
      {
        label: "Create recommended thread",
        action: "create_recommended_thread",
      },
    ]);
  });

  it("classifies provider access-denied codes as recoverable access failures", () => {
    expect(
      resolveRecoverableErrorCode({
        code: "provider_access_denied",
        error: new Error("agent run failed: access denied"),
      }),
    ).toBe("provider_access_denied");
  });

  it("classifies 403 region restrictions as provider access failures", () => {
    expect(
      resolveRecoverableErrorCode({
        error: new Error(
          "Error code: 403 - {'error': {'message': 'This model is not available in your region.', 'code': 403}}",
        ),
      }),
    ).toBe("provider_access_denied");
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
