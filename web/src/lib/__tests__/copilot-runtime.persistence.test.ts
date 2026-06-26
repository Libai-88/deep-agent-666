import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentPresetCatalog } from "../agent-presets";
import { createRuntimeFromCatalog } from "../copilot-runtime";
import { createCopilotRuntimeHandler } from "../copilotkit-runtime-v2";

const TEST_CATALOG: AgentPresetCatalog = {
  defaultPresetId: "openai-balanced",
  presets: [
    {
      id: "openai-balanced",
      label: "OpenAI / Balanced",
      provider: "openai",
      permissionMode: "balanced",
    },
  ],
};

type RuntimeWithClosableRunner = {
  runner?: {
    close?: () => void;
  };
};

type BackendRequestBody = {
  threadId?: string;
  runId?: string;
  messages?: Array<{ id: string; role: string; content: string }>;
};

const runtimesToClose: RuntimeWithClosableRunner[] = [];
const tempDirsToRemove: string[] = [];
const originalFetch = globalThis.fetch;

function buildAssistantRunStream(threadId: string, runId: string): string {
  return [
    `data: ${JSON.stringify({ type: "RUN_STARTED", threadId, runId })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_START",
      messageId: "assistant-message-1",
      role: "assistant",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "assistant-message-1",
      delta: "Persisted assistant reply from backend.",
    })}`,
    `data: ${JSON.stringify({
      type: "TEXT_MESSAGE_END",
      messageId: "assistant-message-1",
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

function createByteStreamResponse(body: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
      },
    },
  );
}

async function readResponsePayload(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let payload = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (typeof value === "string") {
      payload += value;
      continue;
    }

    payload += decoder.decode(value, { stream: true });
  }

  payload += decoder.decode();
  return payload;
}

function createRuntimeHandler(dbPath: string, baseUrl: string) {
  const runtime = createRuntimeFromCatalog(TEST_CATALOG, baseUrl, dbPath) as
    & ReturnType<typeof createRuntimeFromCatalog>
    & RuntimeWithClosableRunner;
  runtimesToClose.push(runtime);

  return createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
  });
}

async function postRuntimeRequest(
  handler: ReturnType<typeof createCopilotRuntimeHandler>,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return handler(
    new Request(`http://127.0.0.1:3000${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;

  while (runtimesToClose.length > 0) {
    runtimesToClose.pop()?.runner?.close?.();
  }

  while (tempDirsToRemove.length > 0) {
    const tempDir = tempDirsToRemove.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("copilot runtime sqlite persistence", () => {
  it("restores thread history across runtime instances without a live backend", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "copilot-runtime-persist-"));
    tempDirsToRemove.push(tempDir);
    const dbPath = join(tempDir, "threads.db");
    const threadId = "persisted-runtime-thread";
    const firstRunId = "persisted-run-1";
    const reconnectRunId = "persisted-connect-1";
    const userPrompt = "Persist this local task across runtime restart.";
    const backendBaseUrl = "http://127.0.0.1:43111";
    const capturedBodies: BackendRequestBody[] = [];

    globalThis.fetch = (async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `${backendBaseUrl}/openai-balanced`) {
        const rawBody =
          typeof init?.body === "string" ? init.body : await new Request("http://local", init).text();
        const body = JSON.parse(rawBody) as BackendRequestBody;
        capturedBodies.push(body);
        return createByteStreamResponse(
          buildAssistantRunStream(
            body.threadId ?? "thread-missing",
            body.runId ?? "run-missing",
          ),
        );
      }

      throw new Error(`Unexpected backend fetch: ${url}`);
    }) as typeof fetch;

    const firstHandler = createRuntimeHandler(dbPath, backendBaseUrl);
    const runResponse = await postRuntimeRequest(
      firstHandler,
      "/api/copilotkit/agent/openai-balanced/run",
      {
        threadId,
        runId: firstRunId,
        messages: [{ id: "user-message-1", role: "user", content: userPrompt }],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      },
    );

    expect(runResponse.status).toBe(200);
    const runPayload = await readResponsePayload(runResponse);
    expect(runPayload).toContain('"type":"RUN_FINISHED"');
    expect(runPayload).toContain("Persisted assistant reply from backend.");
    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]?.messages?.[0]?.content).toBe(userPrompt);

    const restoredHandler = createRuntimeHandler(dbPath, "http://127.0.0.1:9");
    const connectResponse = await postRuntimeRequest(
      restoredHandler,
      "/api/copilotkit/agent/openai-balanced/connect",
      {
        threadId,
        runId: reconnectRunId,
        messages: [],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      },
    );

    expect(connectResponse.status).toBe(200);
    const connectPayload = await readResponsePayload(connectResponse);
    expect(connectPayload).toContain('"type":"RUN_STARTED"');
    expect(connectPayload).toContain(userPrompt);
    expect(connectPayload).toContain("Persisted assistant reply from backend.");
    expect(capturedBodies).toHaveLength(1);
  });
});
