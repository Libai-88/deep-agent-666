import { expect, test } from "@playwright/test";

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-queued-retry-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-queued-retry-1",
      delta: "Queued retry completed after reconnect.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-queued-retry-1",
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

test("preserves retry-last-task intent across reconnect and lets the user replay in-thread", async ({
  page,
}) => {
  const threadId = "queued-retry-thread";
  let recovered = false;
  let capturedRunBody: Record<string, unknown> | null = null;

  await page.addInitScript(([storedThreadId]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Queued retry thread",
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
        lastUserPrompt: "Retry this task after the backend recovers.",
        updatedAt: Date.now(),
      }),
    );
  }, [threadId]);

  await page.route("**/api/preset-state", async (route) => {
    if (!recovered) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "backend offline",
        }),
      });
      return;
    }

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

  await page.route("**/api/runtime-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        workspaceRoot: "D:\\AgentBuild",
        providers: {
          openai: {
            configured: true,
            baseUrl: "https://api.openai.com/v1",
          },
          anthropic: {
            configured: false,
            baseUrl: null,
          },
          google: {
            configured: false,
            baseUrl: null,
          },
        },
      }),
    });
  });

  await page.route("**/api/runtime-diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        recovered
          ? {
              status: "healthy",
              backendReachable: true,
              catalogSource: "live",
              launchablePresetCount: 1,
              configuredProviderCount: 1,
              workspaceRoot: "D:\\AgentBuild",
              providers: {
                openai: {
                  configured: true,
                  baseUrl: "https://api.openai.com/v1",
                },
                anthropic: {
                  configured: false,
                  baseUrl: null,
                },
                google: {
                  configured: false,
                  baseUrl: null,
                },
              },
              checkedAt: "2026-06-27T00:01:00.000Z",
            }
          : {
              status: "offline",
              backendReachable: false,
              catalogSource: "fallback",
              launchablePresetCount: 0,
              configuredProviderCount: 1,
              workspaceRoot: "D:\\AgentBuild",
              providers: {
                openai: {
                  configured: true,
                  baseUrl: "https://api.openai.com/v1",
                },
                anthropic: {
                  configured: false,
                  baseUrl: null,
                },
                google: {
                  configured: false,
                  baseUrl: null,
                },
              },
              checkedAt: "2026-06-27T00:00:00.000Z",
            },
      ),
    });
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "sse",
        agents: recovered
          ? {
              default: { id: "coordinator-openai-balanced" },
              "openai-balanced": { id: "openai-balanced" },
              "coordinator-openai-balanced": {
                id: "coordinator-openai-balanced",
              },
            }
          : {},
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
        requestBody.runId ?? "queued-retry-run",
      ),
    });
  });

  await page.goto(`/?threadId=${threadId}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Retry last task" })).toBeVisible();
  await page.getByRole("button", { name: "Retry last task" }).click();

  recovered = true;

  await page.getByRole("button", { name: "Retry connection" }).click();

  await expect(
    page.getByRole("button", { name: "Create recommended thread" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry last task" })).toBeVisible();

  await page.getByRole("button", { name: "Retry last task" }).click();

  await expect.poll(() => capturedRunBody !== null).toBe(true);
  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Queued retry completed after reconnect.", {
    timeout: 10_000,
  });

  const capturedMessages = Array.isArray(capturedRunBody?.["messages"])
    ? capturedRunBody["messages"]
    : [];
  expect(JSON.stringify(capturedMessages)).toContain(
    "Retry this task after the backend recovers.",
  );
});
