export type RecoverableErrorCode =
  | "backend_unreachable"
  | "no_available_presets"
  | "configuration_failed"
  | "thread_missing_or_invalid"
  | "thread_history_unavailable"
  | "provider_rate_limited"
  | "provider_model_unavailable"
  | "provider_access_denied"
  | "provider_auth_failed"
  | "runtime_request_failed";

export type RecoverableAction = {
  label: string;
  action:
    | "retry_connection"
    | "open_settings"
    | "configure_provider"
    | "retry_save"
    | "check_base_url"
    | "create_recommended_thread"
    | "retry_last_task";
};

export function resolveRecoverableActions(
  code: RecoverableErrorCode,
): RecoverableAction[] {
  switch (code) {
    case "backend_unreachable":
      return [
        { label: "Retry connection", action: "retry_connection" },
        { label: "Open settings", action: "open_settings" },
      ];
    case "no_available_presets":
      return [{ label: "Configure provider", action: "configure_provider" }];
    case "configuration_failed":
      return [
        { label: "Retry save", action: "retry_save" },
        { label: "Check base URL", action: "check_base_url" },
      ];
    case "thread_missing_or_invalid":
      return [
        {
          label: "Create recommended thread",
          action: "create_recommended_thread",
        },
      ];
    case "thread_history_unavailable":
      return [
        { label: "Retry last task", action: "retry_last_task" },
        {
          label: "Create recommended thread",
          action: "create_recommended_thread",
        },
      ];
    case "provider_rate_limited":
      return [
        { label: "Open settings", action: "open_settings" },
        { label: "Retry last task", action: "retry_last_task" },
      ];
    case "provider_access_denied":
    case "provider_model_unavailable":
    case "provider_auth_failed":
      return [
        { label: "Open settings", action: "open_settings" },
        { label: "Retry last task", action: "retry_last_task" },
      ];
    case "runtime_request_failed":
      return [{ label: "Retry last task", action: "retry_last_task" }];
  }
}

function extractRuntimeErrorMessage(value: unknown): string {
  if (!value) {
    return "";
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    detail?: unknown;
    cause?: unknown;
  };

  return (
    extractRuntimeErrorMessage(candidate.error) ||
    extractRuntimeErrorMessage(candidate.message) ||
    extractRuntimeErrorMessage(candidate.detail) ||
    extractRuntimeErrorMessage(candidate.cause)
  );
}

function extractRuntimeErrorCode(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    code?: unknown;
    error?: unknown;
    cause?: unknown;
  };

  if (typeof candidate.code === "string") {
    return candidate.code;
  }

  return (
    extractRuntimeErrorCode(candidate.error) ||
    extractRuntimeErrorCode(candidate.cause)
  );
}

export function resolveRecoverableErrorCode(value: unknown): RecoverableErrorCode {
  const code = extractRuntimeErrorCode(value);
  const message = extractRuntimeErrorMessage(value).toLowerCase();

  if (code === "provider_rate_limited") {
    return "provider_rate_limited";
  }

  if (code === "provider_model_unavailable") {
    return "provider_model_unavailable";
  }

  if (code === "provider_access_denied") {
    return "provider_access_denied";
  }

  if (code === "provider_auth_failed") {
    return "provider_auth_failed";
  }

  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("free-models-per-day")
  ) {
    return "provider_rate_limited";
  }

  if (
    message.includes("model not found") ||
    message.includes("invalid model") ||
    message.includes("not a valid model")
  ) {
    return "provider_model_unavailable";
  }

  if (
    message.includes("not available in your region") ||
    message.includes("access denied") ||
    message.includes("forbidden") ||
    message.includes("error code: 403")
  ) {
    return "provider_access_denied";
  }

  if (
    message.includes("incorrect api key") ||
    message.includes("invalid api key") ||
    message.includes("unauthorized") ||
    message.includes("401")
  ) {
    return "provider_auth_failed";
  }

  return "runtime_request_failed";
}
