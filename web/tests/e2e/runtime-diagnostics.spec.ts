import { expect, test } from "@playwright/test";

test("shows runtime diagnostics and refreshes back into the starter flow", async ({
  page,
}) => {
  let diagnosticsMode: "offline" | "healthy" = "offline";
  let presetStateMode: "offline" | "healthy" = "offline";

  await page.addInitScript(() => {
    window.localStorage.removeItem("deep-agent-666.threads");
  });

  await page.route("**/api/preset-state", async (route) => {
    if (presetStateMode === "offline") {
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
    if (diagnosticsMode === "offline") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
      }),
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Backend unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "View diagnostics" })).toBeVisible();

  await page.getByRole("button", { name: "View diagnostics" }).click();
  await expect(page.getByTestId("runtime-diagnostics-dialog")).toBeVisible();
  await expect(page.getByText("Fallback cache")).toBeVisible();
  await expect(
    page.getByTestId("runtime-diagnostics-dialog").getByText("D:\\AgentBuild"),
  ).toBeVisible();

  diagnosticsMode = "healthy";
  presetStateMode = "healthy";

  await page.getByTestId("runtime-diagnostics-refresh").click();

  await expect(page.getByTestId("runtime-status-badge")).toContainText("Healthy");
  await expect(page.getByTestId("runtime-diagnostics-dialog")).toContainText(
    "Healthy",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a guided task" }),
  ).toBeVisible();
  await expect(
    page.getByText("Analyze the repository structure"),
  ).toBeVisible();
});
