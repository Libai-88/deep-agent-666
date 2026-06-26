import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type BackendRequestBody = {
  threadId?: string;
  runId?: string;
  messages?: Array<{ id: string; role: string; content: string }>;
};

type RouteModule = {
  POST: (request: Request) => Promise<Response>;
  __closeRunnerForTests?: () => void;
};

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
      delta: "Recovered through the real route runtime.",
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

async function postRouteRequest(
  routeModule: RouteModule,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return routeModule.POST(
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
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.AGENT_BASE_URL;
  delete process.env.COPILOTKIT_THREADS_DB_PATH;
  delete process.env.COPILOTKIT_RUNTIME_CATALOG_PATH;
  delete process.env.MCP_SERVER_URL;
});

describe("copilotkit route runtime persistence", () => {
  it(
    "restores a persisted thread after the live preset catalog becomes unavailable",
    async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "route-runtime-persist-"));
    const threadsDbPath = join(tempDir, "threads.db");
    const catalogCachePath = join(tempDir, "runtime-catalog.json");
    const backendBaseUrl = "http://127.0.0.1:43112";
    const threadId = "route-persisted-thread";
    const runId = "route-run-1";
    const reconnectRunId = "route-connect-1";
    const userPrompt = "Keep this route-level thread recoverable.";
    const capturedBodies: BackendRequestBody[] = [];
    let presetCatalogAvailable = true;
    let remoteAgentAvailable = true;

    process.env.AGENT_BASE_URL = backendBaseUrl;
    process.env.COPILOTKIT_THREADS_DB_PATH = threadsDbPath;
    process.env.COPILOTKIT_RUNTIME_CATALOG_PATH = catalogCachePath;

    globalThis.fetch = vi.fn(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === `${backendBaseUrl}/presets`) {
        if (!presetCatalogAvailable) {
          throw new Error("preset catalog offline");
        }

        return Response.json({
          defaultPresetId: "openai-balanced",
          presets: [
            {
              id: "openai-balanced",
              label: "OpenAI / Balanced",
              permission_mode: "balanced",
            },
          ],
        });
      }

      if (url === `${backendBaseUrl}/openai-balanced`) {
        if (!remoteAgentAvailable) {
          throw new Error("remote agent offline");
        }

        const rawBody =
          typeof init?.body === "string"
            ? init.body
            : await new Request("http://local", init).text();
        const body = JSON.parse(rawBody) as BackendRequestBody;
        capturedBodies.push(body);

        return createByteStreamResponse(
          buildAssistantRunStream(
            body.threadId ?? "thread-missing",
            body.runId ?? "run-missing",
          ),
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    let firstRouteModule: RouteModule | null = null;
    let secondRouteModule: RouteModule | null = null;

    try {
      firstRouteModule = (await import("./route")) as RouteModule;
      const firstRun = await postRouteRequest(
        firstRouteModule,
        "/api/copilotkit/agent/openai-balanced/run",
        {
          threadId,
          runId,
          messages: [{ id: "user-message-1", role: "user", content: userPrompt }],
          state: {},
          tools: [],
          context: [],
          forwardedProps: {},
        },
      );

      expect(firstRun.status).toBe(200);
      const firstPayload = await readResponsePayload(firstRun);
      expect(firstPayload).toContain("Recovered through the real route runtime.");
      expect(capturedBodies).toHaveLength(1);
      expect(capturedBodies[0]?.messages?.[0]?.content).toBe(userPrompt);

      presetCatalogAvailable = false;
      remoteAgentAvailable = false;
      vi.resetModules();

      secondRouteModule = (await import("./route")) as RouteModule;
      const restored = await postRouteRequest(
        secondRouteModule,
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

      expect(restored.status).toBe(200);
      const restoredPayload = await readResponsePayload(restored);
      expect(restoredPayload).toContain(userPrompt);
      expect(restoredPayload).toContain(
        "Recovered through the real route runtime.",
      );
      expect(capturedBodies).toHaveLength(1);
    } finally {
      firstRouteModule?.__closeRunnerForTests?.();
      secondRouteModule?.__closeRunnerForTests?.();
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // The focused RED/GREEN cycle should surface route assertions, not file-handle cleanup noise.
      }
    }
    },
    15_000,
  );
});
