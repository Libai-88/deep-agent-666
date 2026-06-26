import { expect, test } from "@playwright/test";

function buildPartialConnectHistoryStream(threadId: string): string {
  return [
    `data: ${JSON.stringify({
      type: "RUN_STARTED",
      threadId,
      runId: "older-run",
      input: {
        threadId,
        runId: "older-run",
        parentRunId: undefined,
        state: {},
        messages: [
          {
            id: "older-user-message",
            role: "user",
            content: "Older restored prompt.",
          },
          {
            id: "older-assistant-message",
            role: "assistant",
            content: "Older restored answer.",
          },
        ],
        tools: [],
        context: [],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "RUN_FINISHED",
      threadId,
      runId: "older-run",
      outcome: { type: "success" },
    })}`,
    "",
    "",
  ].join("\n\n");
}

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-history-drift-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-history-drift-1",
      delta: "Recovered after history drift.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-history-drift-1",
    })}`,
    `data: ${JSON.stringify({
      type: "RUN_FINISHED",
      threadId,
      runId,
      outcome: { type: "success" },
    })}`,
    "",
    "",
  ].join("\n\n");
}

test("warns when restored runtime history misses the latest local task", async ({
  page,
}) => {
  const threadId = "thread-history-drift";
  let capturedRunBody: Record<string, unknown> | null = null;

  await page.addInitScript(([storedThreadId]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Drifted thread",
          presetId: "openai-balanced",
          updatedAt: Date.now(),
        },
      ]),
    );
    window.localStorage.setItem(
      `deep-agent-666.workbench.${storedThreadId}`,
      JSON.stringify({
        taskKind: "general",
        todos: [],
        artifacts: [],
        finalSummary: null,
        lastUserPrompt: "Latest local task that runtime forgot.",
        updatedAt: Date.now(),
      }),
    );
  }, [threadId]);

  await page.route("**/api/preset-state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live",
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      }),
    });
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "sse",
        agents: {
          default: { id: "coordinator-openai-balanced" },
          "coordinator-openai-balanced": {
            id: "coordinator-openai-balanced",
          },
          "openai-balanced": { id: "openai-balanced" },
        },
      }),
    });
  });

  await page.route("**/api/copilotkit/agent/**/connect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildPartialConnectHistoryStream(threadId),
    });
  });

  await page.route("**/api/copilotkit/agent/**/run", async (route) => {
    capturedRunBody = route.request().postDataJSON() as Record<string, unknown>;
    const requestBody = capturedRunBody as { threadId?: string; runId?: string };
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildAssistantRunStream(
        requestBody.threadId ?? threadId,
        requestBody.runId ?? "history-drift-run",
      ),
    });
  });

  await page.goto(`/?threadId=${threadId}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Thread history unavailable")).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Retry last task" }).click();
  await expect.poll(() => capturedRunBody !== null).toBe(true);

  const capturedMessages = Array.isArray(capturedRunBody?.["messages"])
    ? capturedRunBody["messages"]
    : [];
  expect(JSON.stringify(capturedMessages)).toContain(
    "Latest local task that runtime forgot.",
  );
});
