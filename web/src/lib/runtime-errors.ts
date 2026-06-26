export type RecoverableErrorCode =
  | "backend_unreachable"
  | "no_available_presets"
  | "configuration_failed"
  | "thread_missing_or_invalid"
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
    case "runtime_request_failed":
      return [{ label: "Retry last task", action: "retry_last_task" }];
  }
}
