import { expect, test } from "@playwright/test";

function buildCoordinatorReplayRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "planner-call-replay-1",
      toolCallName: "planner_tool",
      parentMessageId: "assistant-message-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "planner-call-replay-1",
      delta: JSON.stringify({ task: "Rebuild the coordinator recovery plan." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "planner-call-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "planner-call-replay-1",
      messageId: "tool-message-planner-replay-1",
      role: "tool",
      content: "Planner rebuilt the coordinator recovery plan.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-replay-1",
            sub_agent: "planner",
            task: "Rebuild the coordinator recovery plan.",
            status: "completed",
            result: "Planner rebuilt the coordinator recovery plan.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "executor-call-replay-1",
      toolCallName: "executor_tool",
      parentMessageId: "assistant-message-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "executor-call-replay-1",
      delta: JSON.stringify({ task: "Re-run the coordinator task after reconnect." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "executor-call-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "executor-call-replay-1",
      messageId: "tool-message-executor-replay-1",
      role: "tool",
      content: "Executor replayed the task in the same thread.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-replay-1",
            sub_agent: "planner",
            task: "Rebuild the coordinator recovery plan.",
            status: "completed",
            result: "Planner rebuilt the coordinator recovery plan.",
          },
          {
            id: "delegation-executor-replay-1",
            sub_agent: "executor",
            task: "Re-run the coordinator task after reconnect.",
            status: "completed",
            result: "Executor replayed the task in the same thread.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "reviewer-call-replay-1",
      toolCallName: "reviewer_tool",
      parentMessageId: "assistant-message-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "reviewer-call-replay-1",
      delta: JSON.stringify({ task: "Confirm the restored coordinator outcome." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "reviewer-call-replay-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "reviewer-call-replay-1",
      messageId: "tool-message-reviewer-replay-1",
      role: "tool",
      content: "Reviewer confirmed the restored coordinator outcome.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        final_summary: "Coordinator replay completed after reconnect.",
        delegations: [
          {
            id: "delegation-planner-replay-1",
            sub_agent: "planner",
            task: "Rebuild the coordinator recovery plan.",
            status: "completed",
            result: "Planner rebuilt the coordinator recovery plan.",
          },
          {
            id: "delegation-executor-replay-1",
            sub_agent: "executor",
            task: "Re-run the coordinator task after reconnect.",
            status: "completed",
            result: "Executor replayed the task in the same thread.",
          },
          {
            id: "delegation-reviewer-replay-1",
            sub_agent: "reviewer",
            task: "Confirm the restored coordinator outcome.",
            status: "completed",
            result: "Reviewer confirmed the restored coordinator outcome.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-replay-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-replay-1",
      delta: "Coordinator replay completed after reconnect.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-replay-1",
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

test("replays a restored coordinator thread after reconnect and refreshes workbench surfaces", async ({
  page,
}) => {
  const threadId = "coordinator-recovery-replay-thread";
  const latestPrompt =
    "Analyze the repository again after reconnect and rebuild the coordinator plan.";
  let recovered = false;
  let capturedRunUrl = "";
  let capturedRunBody: Record<string, unknown> | null = null;

  await page.addInitScript(([storedThreadId, storedPrompt]) => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: storedThreadId,
          title: "Coordinator recovery replay",
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
            id: "todo-persisted-old",
            content: "Persisted coordinator task before reconnect",
            status: "completed",
            source: "agent",
          },
        ],
        artifacts: [],
        finalSummary: "Persisted coordinator summary before replay.",
        lastUserPrompt: storedPrompt,
        updatedAt: Date.now(),
      }),
    );
  }, [threadId, latestPrompt]);

  await page.route("**/api/preset-state", async (route) => {
    if (!recovered) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "backend offline" }),
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        recovered
          ? {
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
            }
          : {
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
            },
      ),
    });
  });

  await page.route("**/api/copilotkit/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "sse",
        agents: recovered
          ? {
              default: { id: "coordinator-openai-balanced" },
              "coordinator-openai-balanced": {
                id: "coordinator-openai-balanced",
              },
              "openai-balanced": { id: "openai-balanced" },
            }
          : {},
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
    capturedRunBody = route.request().postDataJSON() as Record<string, unknown>;
    const requestBody = capturedRunBody as { threadId?: string; runId?: string };

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildCoordinatorReplayRunStream(
        requestBody.threadId ?? threadId,
        requestBody.runId ?? "coordinator-recovery-replay-run",
      ),
    });
  });

  await page.goto(`/?threadId=${threadId}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Backend unavailable")).toBeVisible();
  await expect(page.getByText("Persisted coordinator summary before replay.")).toBeVisible();
  await expect(
    page.getByText("Persisted coordinator task before reconnect"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry last task" })).toBeVisible();

  await page.getByRole("button", { name: "Retry last task" }).click();

  recovered = true;

  await page.getByRole("button", { name: "Retry connection" }).click();

  await expect(page.getByText("Thread history unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Retry last task" }).click();

  await expect.poll(() => capturedRunUrl).toContain(
    "coordinator-openai-balanced",
  );
  await expect.poll(() => capturedRunBody !== null).toBe(true);
  await expect(
    page.locator('[data-testid="copilot-assistant-message"]').first(),
  ).toContainText("Coordinator replay completed after reconnect.", {
    timeout: 10_000,
  });

  await expect(page.getByTestId("subagent-card-planner")).toBeVisible();
  await expect(page.getByTestId("subagent-card-executor")).toBeVisible();
  await expect(page.getByTestId("subagent-card-reviewer")).toBeVisible();
  await expect(
    page
      .getByTestId("task-timeline-panel")
      .getByText("Rebuild the coordinator recovery plan."),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("task-timeline-panel")
      .getByText("Persisted coordinator task before reconnect"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("artifact-final-summary").getByText(
      "Reviewer confirmed the restored coordinator outcome.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Persisted coordinator summary before replay.")).toHaveCount(0);

  const capturedMessages = Array.isArray(capturedRunBody?.["messages"])
    ? capturedRunBody["messages"]
    : [];
  expect(JSON.stringify(capturedMessages)).toContain(latestPrompt);
});
