import type { AgentPresetCatalog } from "./agent-presets";
import type { CatalogSource } from "./preset-catalog";
import type { LocalThread } from "./thread-registry";
import type { RecoverableErrorCode } from "./runtime-errors";

export type FirstRunState =
  | "checking"
  | "unconfigured"
  | "ready-no-thread"
  | "ready-active-thread"
  | "recoverable-error";

export type FirstRunResolutionInput = {
  isChecking: boolean;
  catalog: AgentPresetCatalog;
  catalogSource: CatalogSource;
  threads: LocalThread[];
  activeThreadId: string | null;
  recoverableError: RecoverableErrorCode | null;
};

export function resolveFirstRunState(
  input: FirstRunResolutionInput,
): FirstRunState {
  if (input.isChecking) {
    return "checking";
  }

  if (input.recoverableError) {
    return "recoverable-error";
  }

  if (input.catalog.presets.length === 0) {
    return "unconfigured";
  }

  if (!input.activeThreadId) {
    return "ready-no-thread";
  }

  const hasActiveThread = input.threads.some(
    (thread) => thread.id === input.activeThreadId,
  );

  return hasActiveThread ? "ready-active-thread" : "recoverable-error";
}
