import { expect, test } from "@playwright/test";

test("settings loads and saves the active workspace root through the app route", async ({
  page,
}) => {
  let configured = false;
  let capturedRuntimeConfigBody: Record<string, unknown> | null = null;

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

  await page.route("**/api/runtime-config", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaceRoot: configured
            ? "D:\\Repos\\demo-project"
            : "D:\\AgentBuild\\seed-workspace",
          providers: {
            openai: {
              configured: configured,
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
      return;
    }

    capturedRuntimeConfigBody = JSON.parse(
      route.request().postData() ?? "{}",
    ) as Record<string, unknown>;
    configured = true;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        preset_count: 1,
        preset_ids: ["openai-balanced"],
        workspaceRoot: "D:\\Repos\\demo-project",
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

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("workspace-root-input")).toHaveValue(
    "D:\\AgentBuild\\seed-workspace",
  );

  await page.getByTestId("workspace-root-input").fill("D:\\Repos\\demo-project");
  await page.locator('input[type="password"]').first().fill("test-openai-key");
  await page.getByRole("button", { name: "Save & Apply" }).click();

  expect(capturedRuntimeConfigBody).toEqual({
    agent_workspace_root: "D:\\Repos\\demo-project",
    openai_api_key: "test-openai-key",
    openai_base_url: "https://api.openai.com/v1",
  });

  await expect(page.getByTestId("workspace-root-input")).toHaveCount(0);
  await expect(page.getByTestId("workspace-root-label")).toContainText(
    "D:\\Repos\\demo-project",
  );
});
