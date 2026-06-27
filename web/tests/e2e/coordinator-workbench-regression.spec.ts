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
        workbench_events: [
          {
            id: "event-planner-1",
            kind: "delegation",
            status: "completed",
            title: "Planner finished",
            message: "Inspect the repository architecture.",
            source: "planner",
            artifact_path: null,
            artifact_kind: null,
          },
        ],
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
      type: "TOOL_CALL_START",
      toolCallId: "replace-call-1",
      toolCallName: "replace_text_in_file_tool",
      parentMessageId: "assistant-message-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "replace-call-1",
      delta: JSON.stringify({
        path: "docs/plan.md",
        old_text: "draft architecture",
        new_text: "final architecture",
      }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "replace-call-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "replace-call-1",
      messageId: "tool-message-replace-1",
      role: "tool",
      content: JSON.stringify({
        summary: "updated docs/plan.md",
        path: "docs/plan.md",
        change_type: "modified",
        before: "draft architecture",
        after: "final architecture",
        a2ui_operations: [
          {
            version: "v0.9",
            createSurface: {
              surfaceId: "diff-preview-docs-plan-md",
              catalogId: "deepagent://a2ui-catalog",
            },
          },
          {
            version: "v0.9",
            updateComponents: {
              surfaceId: "diff-preview-docs-plan-md",
              components: [
                {
                  id: "root",
                  component: "DiffPreview",
                  filePath: "docs/plan.md",
                  before: "draft architecture",
                  after: "final architecture",
                },
              ],
            },
          },
        ],
      }),
    })}`,
    `data: ${JSON.stringify({
      type: "ACTIVITY_SNAPSHOT",
      messageId: "a2ui-activity-replace-1",
      activityType: "a2ui-surface",
      content: {
        a2ui_operations: [
          {
            version: "v0.9",
            createSurface: {
              surfaceId: "diff-preview-docs-plan-md",
              catalogId: "deepagent://a2ui-catalog",
            },
          },
          {
            version: "v0.9",
            updateComponents: {
              surfaceId: "diff-preview-docs-plan-md",
              components: [
                {
                  id: "root",
                  component: "DiffPreview",
                  filePath: "docs/plan.md",
                  before: "draft architecture",
                  after: "final architecture",
                },
              ],
            },
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        workbench_events: [
          {
            id: "event-planner-1",
            kind: "delegation",
            status: "completed",
            title: "Planner finished",
            message: "Inspect the repository architecture.",
            source: "planner",
            artifact_path: null,
            artifact_kind: null,
          },
          {
            id: "event-executor-1",
            kind: "delegation",
            status: "completed",
            title: "Executor finished",
            message: "Inspect risky files and TODOs.",
            source: "executor",
            artifact_path: null,
            artifact_kind: null,
          },
          {
            id: "event-artifact-1",
            kind: "artifact",
            status: "completed",
            title: "updated docs/plan.md",
            message: "updated docs/plan.md",
            source: "tool",
            artifact_path: "docs/plan.md",
            artifact_kind: "file",
          },
        ],
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
        workbench_events: [
          {
            id: "event-planner-1",
            kind: "delegation",
            status: "completed",
            title: "Planner finished",
            message: "Inspect the repository architecture.",
            source: "planner",
            artifact_path: null,
            artifact_kind: null,
          },
          {
            id: "event-executor-1",
            kind: "delegation",
            status: "completed",
            title: "Executor finished",
            message: "Inspect risky files and TODOs.",
            source: "executor",
            artifact_path: null,
            artifact_kind: null,
          },
          {
            id: "event-artifact-1",
            kind: "artifact",
            status: "completed",
            title: "updated docs/plan.md",
            message: "updated docs/plan.md",
            source: "tool",
            artifact_path: "docs/plan.md",
            artifact_kind: "file",
          },
          {
            id: "event-reviewer-1",
            kind: "delegation",
            status: "completed",
            title: "Reviewer completed",
            message: "Reviewer confirmed the next engineering steps.",
            source: "reviewer",
            artifact_path: null,
            artifact_kind: "summary",
          },
        ],
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
        a2uiEnabled: true,
        a2ui: {
          enabled: true,
        },
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
  await expect(page.getByTestId("timeline-todo-event-planner-1")).toContainText(
    "Completed",
  );
  await expect(page.getByTestId("timeline-todo-event-executor-1")).toContainText(
    "Completed",
  );
  await expect(page.getByTestId("timeline-todo-event-reviewer-1")).toContainText(
    "Completed",
  );

  await expect(
    page.getByRole("heading", { name: "Results" }),
  ).toBeVisible();
  await expect(page.locator("[data-surface-id='diff-preview-docs-plan-md']")).toBeVisible();
  await expect(page.getByText("Modified")).toBeVisible();
  await expect(page.getByText("Before")).toBeVisible();
  await expect(page.getByText("After")).toBeVisible();
  await expect(
    page.getByTestId("artifact-card-event-artifact-1"),
  ).toBeVisible();
  await expect(
    page.getByTestId("artifact-final-summary").getByText(
      "Reviewer confirmed the next engineering steps.",
    ),
  ).toBeVisible();
});
