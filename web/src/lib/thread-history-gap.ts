import type { ThreadWorkbenchState } from "./workbench-state";

export function hasRestorableThreadContext(
  state: ThreadWorkbenchState,
): boolean {
  return Boolean(
    state.lastUserPrompt ||
      state.finalSummary ||
      state.todos.length > 0 ||
      state.artifacts.length > 0,
  );
}

export function shouldFlagThreadHistoryGap(input: {
  runtimeAvailability: "ready" | "empty" | "unreachable";
  hasRestorableContext: boolean;
  messageCount: number;
}): boolean {
  return (
    input.runtimeAvailability === "ready" &&
    input.hasRestorableContext &&
    input.messageCount === 0
  );
}
