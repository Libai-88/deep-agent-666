import type { AgentPresetCatalog } from "./agent-presets";
import type { CatalogSource } from "./preset-catalog";
import type { LocalThread } from "./thread-registry";
import {
  shouldPreserveActiveThreadShell,
  type RecoverableErrorCode,
} from "./runtime-errors";

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
  const hasActiveThread =
    input.activeThreadId !== null &&
    input.threads.some((thread) => thread.id === input.activeThreadId);

  if (input.isChecking) {
    return "checking";
  }

  if (input.recoverableError) {
    if (
      hasActiveThread &&
      shouldPreserveActiveThreadShell(input.recoverableError)
    ) {
      return "ready-active-thread";
    }
    return "recoverable-error";
  }

  if (input.catalog.presets.length === 0) {
    return "unconfigured";
  }

  if (!input.activeThreadId) {
    return "ready-no-thread";
  }

  return hasActiveThread ? "ready-active-thread" : "recoverable-error";
}
