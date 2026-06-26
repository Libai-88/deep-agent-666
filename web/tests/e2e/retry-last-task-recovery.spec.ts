import { expect, test } from "@playwright/test";

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-retry-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-retry-1",
      delta: "Recovered assistant response.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-retry-1",
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

test("retries the last stored task from a restored thread", async ({ page }) => {
  const threadId = "retry-recovery-thread";
  let capturedRunBody: Record<string, unknown> | null = null;

  await page.addInitScript(([storedThreadId]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Retry recovery thread",
          presetId: "openai-balanced",
          updatedAt: Date.now(),
        },
      ]),
    );
    window.localStorage.setItem(
      `deep-agent-666.workbench.${storedThreadId}`,
      JSON.stringify({
        taskKind: "engineering",
        todos: [],
        artifacts: [],
        finalSummary: null,
        lastUserPrompt: "Inspect SUMMARY.md and tell me the next step.",
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
      body: ": connected\n\n",
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
        requestBody.runId ?? "retry-run",
      ),
    });
  });

  await page.goto(`/?threadId=${threadId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "New Thread" })).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("deep-agent-666.runtime-error", {
        detail: {
          source: "copilotkit",
          event: {
            code: "runtime_request_failed",
            error: {
              message: "The last run failed.",
            },
          },
        },
      }),
    );
  });

  await expect(page.getByText("Agent run interrupted")).toBeVisible();
  await page.getByRole("button", { name: "Retry last task" }).click();

  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Recovered assistant response.");

  const capturedMessages = Array.isArray(capturedRunBody?.["messages"])
    ? capturedRunBody["messages"]
    : [];
  expect(JSON.stringify(capturedMessages)).toContain(
    "Inspect SUMMARY.md and tell me the next step.",
  );
});
