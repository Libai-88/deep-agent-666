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

    await page.goto("/");
    await expect(page.getByText("Assistant")).toBeVisible();
    await expect(page.getByText("Threads")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "+ New", exact: true }),
    ).toBeVisible();
  });
}
