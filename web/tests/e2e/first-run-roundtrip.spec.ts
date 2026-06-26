import { expect, test } from "@playwright/test";

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-1",
      delta: "Mock assistant response from the first guided task.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-1",
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

test("first run configure launches and renders the first assistant response", async ({
  page,
}) => {
  let configured = false;
  let capturedConfigureBody: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/preset-state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        configured
          ? {
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
            }
          : {
              source: "fallback",
              defaultPresetId: null,
              presets: [],
            },
      ),
    });
  });

  await page.route("http://127.0.0.1:8123/configure", async (route) => {
    capturedConfigureBody = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    configured = true;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        preset_count: 1,
        preset_ids: ["openai-balanced"],
      }),
    });
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "sse",
        agents: configured
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

  await page.route(
    "**/api/copilotkit/agent/**/run",
    async (route) => {
      const requestBody = route.request().postDataJSON() as {
        threadId?: string;
        runId?: string;
      };
      const threadId = requestBody.threadId ?? "thread-first-run";
      const runId = requestBody.runId ?? "run-first-run";

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: buildAssistantRunStream(threadId, runId),
      });
    },
  );

  await page.route("**/api/copilotkit/agent/**/connect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: ": connected\n\n",
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Configure your providers")).toBeVisible();
  await page.getByRole("button", { name: "Configure provider" }).click();

  await page.locator('input[type="password"]').first().fill("test-openai-key");
  await page.getByRole("button", { name: "Save & Apply" }).click();

  await expect(page.getByText("Start with a guided task")).toBeVisible();

  await page
    .getByRole("button", { name: /Analyze the repository structure/i })
    .click();

  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Mock assistant response from the first guided task.");

  expect(capturedConfigureBody?.["openai_api_key"]).toBe("test-openai-key");
});
