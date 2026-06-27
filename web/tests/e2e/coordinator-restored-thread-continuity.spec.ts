import { expect, test } from "@playwright/test";

function buildCoordinatorRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "planner-call-restore-1",
      toolCallName: "planner_tool",
      parentMessageId: "assistant-message-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "planner-call-restore-1",
      delta: JSON.stringify({ task: "Inspect the repository architecture." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "planner-call-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "planner-call-restore-1",
      messageId: "tool-message-planner-restore-1",
      role: "tool",
      content: "Planner mapped the main modules.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-restore-1",
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
      toolCallId: "executor-call-restore-1",
      toolCallName: "executor_tool",
      parentMessageId: "assistant-message-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "executor-call-restore-1",
      delta: JSON.stringify({ task: "Inspect risky files and TODOs." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "executor-call-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "executor-call-restore-1",
      messageId: "tool-message-executor-restore-1",
      role: "tool",
      content: "Executor found the risky recovery path.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-restore-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-restore-1",
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
      toolCallId: "reviewer-call-restore-1",
      toolCallName: "reviewer_tool",
      parentMessageId: "assistant-message-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "reviewer-call-restore-1",
      delta: JSON.stringify({ task: "Summarize the repository review." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "reviewer-call-restore-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "reviewer-call-restore-1",
      messageId: "tool-message-reviewer-restore-1",
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
            id: "delegation-planner-restore-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-restore-1",
            sub_agent: "executor",
            task: "Inspect risky files and TODOs.",
            status: "completed",
            result: "Executor found the risky recovery path.",
          },
          {
            id: "delegation-reviewer-restore-1",
            sub_agent: "reviewer",
            task: "Summarize the repository review.",
            status: "completed",
            result: "Reviewer confirmed the next engineering steps.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-restore-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-restore-1",
      delta: "Repository review complete.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-restore-1",
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

function buildHealthyConnectHistoryStream(threadId: string, prompt: string): string {
  return [
    `data: ${JSON.stringify({
      type: "RUN_STARTED",
      threadId,
      runId: "restored-run",
      input: {
        threadId,
        runId: "restored-run",
        parentRunId: undefined,
        state: {},
        messages: [
          {
            id: "restored-user-message",
            role: "user",
            content: prompt,
          },
          {
            id: "restored-assistant-message",
            role: "assistant",
            content: "Repository review complete.",
          },
        ],
        tools: [],
        context: [],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "RUN_FINISHED",
      threadId,
      runId: "restored-run",
      outcome: { type: "success" },
    })}`,
    "",
    "",
  ].join("\n\n");
}

test("completed coordinator thread reopens cleanly after reload", async ({
  page,
}) => {
  let connectMode: "initial" | "restored" = "initial";
  let capturedThreadId = "coordinator-restored-thread";
  const latestPrompt =
    "Analyze this repository structure and summarize the major modules.";

  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("coordinator-restored-thread-init")) {
      window.localStorage.removeItem("deep-agent-666.threads");
      window.sessionStorage.setItem("coordinator-restored-thread-init", "1");
    }
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
      body:
        connectMode === "restored"
          ? buildHealthyConnectHistoryStream(capturedThreadId, latestPrompt)
          : ": connected\n\n",
    });
  });

  await page.route("**/api/copilotkit/agent/**/run", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      threadId?: string;
      runId?: string;
    };
    capturedThreadId = requestBody.threadId ?? capturedThreadId;

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildCoordinatorRunStream(
        capturedThreadId,
        requestBody.runId ?? "coordinator-restored-run",
      ),
    });
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /Analyze the repository structure/i })
    .click();

  await expect(
    page.getByTestId("artifact-final-summary").getByText(
      "Reviewer confirmed the next engineering steps.",
    ),
  ).toBeVisible();
  await expect(
    page.getByTestId("task-timeline-panel").getByText("Completed"),
  ).toHaveCount(3);

  connectMode = "restored";
  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText("Thread history unavailable"),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Repository review complete.");
  await expect(
    page
      .getByTestId("task-timeline-panel")
      .getByText("Inspect the repository architecture."),
  ).toBeVisible();
  await expect(
    page.getByTestId("task-timeline-panel").getByText("Completed"),
  ).toHaveCount(3);
  await expect(
    page.getByTestId("artifact-final-summary").getByText(
      "Repository review complete.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Analyze the repository structure/i }),
  ).toHaveCount(0);
});
