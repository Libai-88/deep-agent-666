type MessageLike = {
  role?: string;
  content?: unknown;
};

function normalizePrompt(value: unknown): string {
  const text = Array.isArray(value)
    ? value.map((part) => normalizePrompt(part)).join(" ")
    : typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (() => {
            const candidate = value as {
              text?: unknown;
              value?: unknown;
              content?: unknown;
            };

            if (typeof candidate.text === "string") {
              return candidate.text;
            }

            if (typeof candidate.value === "string") {
              return candidate.value;
            }

            if (candidate.content !== undefined) {
              return normalizePrompt(candidate.content);
            }

            return String(value ?? "");
          })()
        : String(value ?? "");

  return text.replace(/\s+/g, " ").trim();
}

export function extractLatestUserPrompt(
  messages: readonly MessageLike[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }

    const prompt = normalizePrompt(message.content);
    if (prompt) {
      return prompt;
    }
  }

  return null;
}

export function extractLatestAssistantText(
  messages: readonly MessageLike[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }

    const text = normalizePrompt(message.content);
    if (text) {
      return text;
    }
  }

  return null;
}

export function resolvePendingRunPrompt(input: {
  requestedPrompt?: string | null;
  latestUserPrompt?: string | null;
}): string | null {
  const requestedPrompt = normalizePrompt(input.requestedPrompt);
  const latestUserPrompt = normalizePrompt(input.latestUserPrompt);

  if (!requestedPrompt || requestedPrompt === latestUserPrompt) {
    return null;
  }

  return requestedPrompt;
}
