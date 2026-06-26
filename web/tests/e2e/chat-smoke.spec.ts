import { expect, test } from "@playwright/test";

const isVitest = Boolean(process.env.VITEST);

if (isVitest) {
  const vitestTest = (
    globalThis as typeof globalThis & {
      test?: { skip: (name: string, fn: () => void) => void };
    }
  ).test;

  vitestTest?.skip("playwright smoke runs via npm run e2e", () => {});
} else {
  test("renders the local agent shell", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "deep-agent-666.threads",
        JSON.stringify([
          {
            id: "thread-smoke-seed",
            title: "Smoke thread",
            presetId: "openai-balanced",
            updatedAt: 0,
          },
        ]),
      );
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

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", {
        name: /Deep Agent 666|Start with a guided task|Configure your providers/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Threads|Settings|New Thread/,
      }).first(),
    ).toBeVisible();
  });
}
