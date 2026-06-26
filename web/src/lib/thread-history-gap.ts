import type { ThreadWorkbenchState } from "./workbench-state";

type MessageLike = {
  role?: string;
  content?: unknown;
};

function normalizeMessageText(content: unknown): string {
  const text = Array.isArray(content)
    ? content.join(" ")
    : typeof content === "string"
      ? content
      : String(content ?? "");

  return text.replace(/\s+/g, " ").trim();
}

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

export function restoredMessagesIncludePrompt(
  messages: readonly MessageLike[],
  prompt: string | null | undefined,
): boolean {
  const normalizedPrompt = normalizeMessageText(prompt);
  if (!normalizedPrompt) {
    return true;
  }

  return messages.some((message) => {
    if (message?.role !== "user") {
      return false;
    }

    return normalizeMessageText(message.content) === normalizedPrompt;
  });
}

export function shouldFlagThreadHistoryGap(input: {
  runtimeAvailability: "ready" | "empty" | "unreachable";
  hasRestorableContext: boolean;
  messageCount: number;
  lastUserPrompt?: string | null;
  restoredPromptPresent?: boolean;
}): boolean {
  if (
    input.runtimeAvailability !== "ready" ||
    !input.hasRestorableContext
  ) {
    return false;
  }

  if (input.messageCount === 0) {
    return true;
  }

  const hasLastUserPrompt = Boolean(normalizeMessageText(input.lastUserPrompt));

  return (
    hasLastUserPrompt &&
    input.restoredPromptPresent === false
  );
}
