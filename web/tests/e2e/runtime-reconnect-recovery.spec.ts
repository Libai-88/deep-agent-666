import { expect, test } from "@playwright/test";

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-reconnect-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-reconnect-1",
      delta: "Recovered runtime response from the guided task.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-reconnect-1",
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

test("recovers runtime bootstrap in the same tab after backend reconnect", async ({
  page,
}) => {
  let recovered = false;

  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

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
    const requestBody = route.request().postDataJSON() as {
      threadId?: string;
      runId?: string;
    };
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildAssistantRunStream(
        requestBody.threadId ?? "runtime-reconnect-thread",
        requestBody.runId ?? "runtime-reconnect-run",
      ),
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Backend unavailable")).toBeVisible();

  recovered = true;

  await page.getByRole("button", { name: "Retry connection" }).click();

  await expect(
    page.getByRole("heading", { name: "Start with a guided task" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: /Analyze the repository structure/i })
    .click();

  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Recovered runtime response from the guided task.", {
    timeout: 10_000,
  });
});
