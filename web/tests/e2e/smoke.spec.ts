import { test, expect } from "@playwright/test";

test.describe("Page loads correctly", () => {
  test("unconfigured launch shows the first-run gate", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("deep-agent-666.threads");
    });

    await page.route("**/api/preset-state", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source: "fallback",
          defaultPresetId: null,
          presets: [],
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Configure your providers")).toBeVisible();
  });

  test("configured launch without a thread shows starter templates", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("deep-agent-666.threads");
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

    await expect(page.getByText("Start with a guided task")).toBeVisible();
  });

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

  test("engineering workbench state restores into the timeline panel", async ({ page }) => {
    const threadId = "e2e-engineering-thread";

    await page.addInitScript(([storedThreadId]) => {
      window.localStorage.setItem(
        "deep-agent-666.threads",
        JSON.stringify([
          {
            id: storedThreadId,
            title: "Engineering thread",
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
              id: "todo-1",
              content: "Inspect the repo",
              status: "in_progress",
              source: "agent",
            },
          ],
          artifacts: [],
          finalSummary: null,
          updatedAt: Date.now(),
        }),
      );
    }, [threadId]);

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

    await page.goto("/?threadId=e2e-engineering-thread");

    await expect(
      page.getByRole("heading", { name: "Engineering" }),
    ).toBeVisible();
    await expect(page.getByText("Inspect the repo")).toBeVisible();
  });

  test("research workbench state restores findings into the results panel", async ({ page }) => {
    const threadId = "e2e-research-thread";

    await page.addInitScript(([storedThreadId]) => {
      window.localStorage.setItem(
        "deep-agent-666.threads",
        JSON.stringify([
          {
            id: storedThreadId,
            title: "Research thread",
            presetId: "openai-balanced",
            updatedAt: Date.now(),
          },
        ]),
      );
      window.localStorage.setItem(
        `deep-agent-666.workbench.${storedThreadId}`,
        JSON.stringify({
          taskKind: "research",
          todos: [
            {
              id: "todo-1",
              content: "Read SUMMARY.md",
              status: "completed",
              source: "agent",
            },
          ],
          artifacts: [
            {
              id: "artifact-1",
              kind: "finding",
              title: "SUMMARY.md",
              content: "Key finding",
              createdAt: Date.now(),
            },
          ],
          finalSummary: "Research complete",
          updatedAt: Date.now(),
        }),
      );
    }, [threadId]);

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

    await page.goto("/?threadId=e2e-research-thread");

    await expect(
      page.getByRole("heading", { name: "Results" }),
    ).toBeVisible();
    await expect(page.getByText("Research complete")).toBeVisible();
    await expect(page.getByText("SUMMARY.md", { exact: true })).toBeVisible();
  });
});
