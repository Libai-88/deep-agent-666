import { expect, test } from "@playwright/test";

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-history-gap-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-history-gap-1",
      delta: "Recovered after history gap.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-history-gap-1",
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

test("warns when a restored thread has local context but runtime history is gone", async ({
  page,
}) => {
  const threadId = "thread-history-gap";
  let capturedRunBody: Record<string, unknown> | null = null;

  await page.addInitScript(([storedThreadId]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Restored thread",
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
        lastUserPrompt: "Recover this missing thread history.",
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
      status: 204,
      body: "",
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
        requestBody.runId ?? "history-gap-run",
      ),
    });
  });

  await page.goto(`/?threadId=${threadId}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Thread history unavailable")).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Retry last task" }).click();

  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Recovered after history gap.");

  const capturedMessages = Array.isArray(capturedRunBody?.["messages"])
    ? capturedRunBody["messages"]
    : [];
  expect(JSON.stringify(capturedMessages)).toContain(
    "Recover this missing thread history.",
  );
});
