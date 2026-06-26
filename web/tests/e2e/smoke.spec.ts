import { test, expect } from "@playwright/test";

test.describe("Page loads correctly", () => {
  test("home page shows no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    // Wait for the page to fully hydrate
    await page.waitForTimeout(3000);

    // No runtime errors
    expect(errors.filter((e) => !e.includes("copilotkit") && !e.includes("INCOMPLETE_STREAM")).length).toBe(0);
  });

  test("runtime info endpoint only exposes configured agents", async ({ request }) => {
    const resp = await request.get("/api/copilotkit/info");
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.agents).toBeDefined();
    expect(data.agents.default).toBeDefined();
    expect(data.agents["openai-balanced"]).toBeDefined();
    expect(data.agents["coordinator-openai-balanced"]).toBeDefined();
    expect(data.agents["anthropic-balanced"]).toBeUndefined();
    expect(data.agents["google-balanced"]).toBeUndefined();
  });

  test("agent run starts an SSE stream against the configured agent", async ({ request }) => {
    const suffix = Date.now().toString();
    const resp = await request.post("/api/copilotkit/agent/openai-balanced/run", {
      data: {
        threadId: `e2e-test-${suffix}`,
        runId: `e2e-run-${suffix}`,
        messages: [{ id: "m1", role: "user", content: "hello" }],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      },
    });
    expect(resp.ok()).toBeTruthy();
    const text = await resp.text();
    expect(text).toContain('"type":"RUN_STARTED"');
    expect(text).toContain('"name":"openai-balanced"');
    expect(text).not.toContain('HTTP 404');
  });
});
