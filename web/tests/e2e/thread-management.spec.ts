import { expect, test } from "@playwright/test";

test("renames and deletes local threads with safe fallback behavior", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: "thread-older",
          title: "Older thread",
          presetId: "openai-balanced",
          updatedAt: 1,
        },
        {
          id: "thread-newer",
          title: "Newer thread",
          presetId: "openai-balanced",
          updatedAt: 2,
        },
      ]),
    );
  });

  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

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

  await page.goto("/?sidebar=1&threadId=thread-older");
  await page.waitForLoadState("networkidle");

  await page.getByTestId("thread-rename-thread-older").click();
  await page.getByTestId("thread-title-input-thread-older").fill("Renamed thread");
  await page.getByTestId("thread-title-input-thread-older").press("Enter");

  await expect(page.getByTestId("thread-item-thread-older")).toContainText(
    "Renamed thread",
  );
  await expect(page.getByTestId("thread-item-thread-older")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(
    page.locator('[data-testid^="thread-item-"]').first(),
  ).toContainText("Renamed thread");

  await page.getByTestId("thread-delete-thread-older").click();

  await expect(page.getByTestId("thread-item-thread-older")).toHaveCount(0);
  await expect(page.getByTestId("thread-item-thread-newer")).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page).toHaveURL(/threadId=thread-newer/);

  await page.getByTestId("thread-delete-thread-newer").click();

  await expect(
    page.getByRole("heading", { name: "Start with a guided task" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/threadId=/);
});
