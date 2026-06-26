import { expect, test } from "@playwright/test";

function buildCoordinatorRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "planner-call-1",
      toolCallName: "planner_tool",
      parentMessageId: "assistant-message-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "planner-call-1",
      delta: JSON.stringify({ task: "Inspect the repository architecture." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "planner-call-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "planner-call-1",
      messageId: "tool-message-planner-1",
      role: "tool",
      content: "Planner mapped the main modules.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "executor-call-1",
      toolCallName: "executor_tool",
      parentMessageId: "assistant-message-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "executor-call-1",
      delta: JSON.stringify({ task: "Inspect risky files and TODOs." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "executor-call-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "executor-call-1",
      messageId: "tool-message-executor-1",
      role: "tool",
      content: "Executor found the risky recovery path.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-1",
            sub_agent: "executor",
            task: "Inspect risky files and TODOs.",
            status: "completed",
            result: "Executor found the risky recovery path.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "reviewer-call-1",
      toolCallName: "reviewer_tool",
      parentMessageId: "assistant-message-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "reviewer-call-1",
      delta: JSON.stringify({ task: "Summarize the repository review." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "reviewer-call-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "reviewer-call-1",
      messageId: "tool-message-reviewer-1",
      role: "tool",
      content: "Reviewer confirmed the next engineering steps.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        final_summary: "Repository review complete.",
        delegations: [
          {
            id: "delegation-planner-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-1",
            sub_agent: "executor",
            task: "Inspect risky files and TODOs.",
            status: "completed",
            result: "Executor found the risky recovery path.",
          },
          {
            id: "delegation-reviewer-1",
            sub_agent: "reviewer",
            task: "Summarize the repository review.",
            status: "completed",
            result: "Reviewer confirmed the next engineering steps.",
          },
        ],
      },
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

test("starter-launched coordinator run updates cards, timeline, and results", async ({
  page,
}) => {
  let capturedRunUrl = "";

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

  await page.route("**/api/copilotkit/agent/**/run", async (route) => {
    capturedRunUrl = route.request().url();
    const requestBody = route.request().postDataJSON() as {
      threadId?: string;
      runId?: string;
    };

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildCoordinatorRunStream(
        requestBody.threadId ?? "coordinator-thread",
        requestBody.runId ?? "coordinator-run",
      ),
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /Analyze the repository structure/i })
    .click();

  await expect.poll(() => capturedRunUrl).toContain(
    "coordinator-openai-balanced",
  );

  await expect(page.getByTestId("subagent-card-planner")).toBeVisible();
  await expect(page.getByTestId("subagent-card-executor")).toBeVisible();
  await expect(page.getByTestId("subagent-card-reviewer")).toBeVisible();
  await expect(
    page.getByTestId("subagent-card-planner").getByText(
      "Planner mapped the main modules.",
    ),
  ).toBeVisible();
  await expect(
    page.getByTestId("subagent-card-executor").getByText(
      "Executor found the risky recovery path.",
    ),
  ).toBeVisible();
  await expect(
    page.getByTestId("subagent-card-reviewer").getByText(
      "Reviewer confirmed the next engineering steps.",
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Engineering" }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("task-timeline-panel")
      .getByText("Inspect the repository architecture."),
  ).toBeVisible();
  await expect(
    page.getByTestId("task-timeline-panel").getByText("Completed"),
  ).toHaveCount(3);

  await expect(
    page.getByRole("heading", { name: "Results" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("artifact-final-summary").getByText(
      "Repository review complete.",
    ),
  ).toBeVisible();
});
