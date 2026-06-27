import { expect, test } from "@playwright/test";

test("keeps the active thread shell visible during recoverable backend failure", async ({
  page,
}) => {
  const threadId = "active-thread-recovery";
  let recovered = false;

  await page.addInitScript(([storedThreadId]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Active recovery thread",
          presetId: "openai-balanced",
          updatedAt: Date.now(),
        },
      ]),
    );
    window.localStorage.setItem(
      `deep-agent-666.workbench.${storedThreadId}`,
      JSON.stringify({
        taskKind: "engineering",
        todos: [
          {
            id: "todo-keep-visible",
            content: "Keep this task visible during recovery",
            status: "in_progress",
            source: "agent",
          },
        ],
        artifacts: [
          {
            id: "artifact-keep-visible",
            kind: "finding",
            title: "Recovered note",
            content: "Persisted result should stay visible.",
            createdAt: Date.now(),
          },
        ],
        finalSummary: "Persisted summary should remain visible.",
        lastUserPrompt: "Continue after the backend comes back.",
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

  await page.goto(`/?threadId=${threadId}&sidebar=1`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Backend unavailable")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Engineering" }),
  ).toBeVisible();
  await expect(
    page.getByText("Keep this task visible during recovery"),
  ).toBeVisible();
  await expect(page.getByText("Persisted summary should remain visible.")).toBeVisible();

  recovered = true;

  await page.getByRole("button", { name: "Retry connection" }).click();

  await expect(
    page.getByRole("heading", { name: "Engineering" }),
  ).toBeVisible();
  await expect(
    page.getByText("Keep this task visible during recovery"),
  ).toBeVisible();
  await expect(page.getByTestId("runtime-status-badge")).toContainText("Healthy");
  await expect(page).toHaveURL(new RegExp(`threadId=${threadId}`));
});
