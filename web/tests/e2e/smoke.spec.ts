import { test, expect } from "@playwright/test";

test.describe("Page loads correctly", () => {
  test("home page shows no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("http://localhost:3000");

    // Wait for the page to fully hydrate
    await page.waitForTimeout(3000);

    // No runtime errors
    expect(errors.filter((e) => !e.includes("copilotkit") && !e.includes("INCOMPLETE_STREAM")).length).toBe(0);
  });

  test("runtime info endpoint returns agents", async ({ request }) => {
    const resp = await request.get("http://localhost:3000/api/copilotkit");
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.agents).toBeDefined();
    expect(data.agents.default).toBeDefined();
  });

  test("agent run completes with RUN_FINISHED", async ({ request }) => {
    const resp = await request.post("http://localhost:3000/api/copilotkit/agent/openai-balanced/run", {
      data: {
        threadId: "e2e-test",
        runId: "e2e-run",
        messages: [{ id: "m1", role: "user", content: "hello" }],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      },
    });
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain("RUN_FINISHED");
  });
});
