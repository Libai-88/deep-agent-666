import http from "node:http";

const port = Number(process.env.STUB_BACKEND_PORT ?? "8923");

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function buildAssistantRunStream(threadId, runId) {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-process-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-process-1",
      delta: "Process restart restore is working.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-process-1",
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

function buildCoordinatorRunStream(threadId, runId) {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_START",
      toolCallId: "planner-call-process-1",
      toolCallName: "planner_tool",
      parentMessageId: "assistant-message-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "planner-call-process-1",
      delta: JSON.stringify({ task: "Inspect the repository architecture." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "planner-call-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "planner-call-process-1",
      messageId: "tool-message-planner-process-1",
      role: "tool",
      content: "Planner mapped the main modules.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-process-1",
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
      toolCallId: "executor-call-process-1",
      toolCallName: "executor_tool",
      parentMessageId: "assistant-message-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "executor-call-process-1",
      delta: JSON.stringify({ task: "Inspect risky files and TODOs." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "executor-call-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "executor-call-process-1",
      messageId: "tool-message-executor-process-1",
      role: "tool",
      content: "Executor found the risky recovery path.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        delegations: [
          {
            id: "delegation-planner-process-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-process-1",
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
      toolCallId: "reviewer-call-process-1",
      toolCallName: "reviewer_tool",
      parentMessageId: "assistant-message-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_ARGS",
      toolCallId: "reviewer-call-process-1",
      delta: JSON.stringify({ task: "Summarize the restart proof." }),
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_END",
      toolCallId: "reviewer-call-process-1",
    })}`,
    `data: ${JSON.stringify({
      type: "TOOL_CALL_RESULT",
      toolCallId: "reviewer-call-process-1",
      messageId: "tool-message-reviewer-process-1",
      role: "tool",
      content: "Reviewer confirmed the restart proof.",
    })}`,
    `data: ${JSON.stringify({
      type: "STATE_SNAPSHOT",
      snapshot: {
        task_kind: "engineering",
        final_summary: "Process restart restore is working.",
        delegations: [
          {
            id: "delegation-planner-process-1",
            sub_agent: "planner",
            task: "Inspect the repository architecture.",
            status: "completed",
            result: "Planner mapped the main modules.",
          },
          {
            id: "delegation-executor-process-1",
            sub_agent: "executor",
            task: "Inspect risky files and TODOs.",
            status: "completed",
            result: "Executor found the risky recovery path.",
          },
          {
            id: "delegation-reviewer-process-1",
            sub_agent: "reviewer",
            task: "Summarize the restart proof.",
            status: "completed",
            result: "Reviewer confirmed the restart proof.",
          },
        ],
      },
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-process-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-process-1",
      delta: "Process restart restore is working.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-process-1",
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

const server = http.createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 404, { detail: "missing request metadata" });
    return;
  }

  if (request.method === "GET" && request.url === "/presets") {
    sendJson(response, 200, {
      defaultPresetId: "openai-balanced",
      presets: [
        {
          id: "openai-balanced",
          label: "OpenAI / Balanced",
          permission_mode: "balanced",
        },
      ],
    });
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && request.url === "/config") {
    sendJson(response, 200, {
      workspace_root: "D:\\AgentBuild",
      providers: {
        openai: {
          configured: true,
          base_url: "https://api.openai.com/v1",
        },
        anthropic: {
          configured: false,
          base_url: null,
        },
        google: {
          configured: false,
          base_url: null,
        },
      },
    });
    return;
  }

  if (request.method === "POST" && request.url === "/openai-balanced") {
    let rawBody = "";
    for await (const chunk of request) {
      rawBody += chunk;
    }

    const payload = JSON.parse(rawBody || "{}");

    response.writeHead(200, {
      "content-type": "text/event-stream",
    });
    response.end(
      buildAssistantRunStream(
        payload.threadId ?? "thread-missing",
        payload.runId ?? "run-missing",
      ),
    );
    return;
  }

  if (request.method === "POST" && request.url === "/coordinator-openai-balanced") {
    let rawBody = "";
    for await (const chunk of request) {
      rawBody += chunk;
    }

    const payload = JSON.parse(rawBody || "{}");

    response.writeHead(200, {
      "content-type": "text/event-stream",
    });
    response.end(
      buildCoordinatorRunStream(
        payload.threadId ?? "thread-missing",
        payload.runId ?? "run-missing",
      ),
    );
    return;
  }

  sendJson(response, 404, { detail: "not found" });
});

server.listen(port, "127.0.0.1");

process.on("SIGTERM", () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => {
    process.exit(0);
  });
});
