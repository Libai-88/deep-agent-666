import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

/**
 * Simple proxy: forwards agent discovery and execution to Python backend.
 *
 * The Runtime is used ONLY for agent discovery (/info) and routing.
 * Agent execution events from the Python backend pass through without
 * transformation, preserving the correct AG-UI event sequence.
 *
 * URL mapping:
 *   GET  /api/copilotkit       → GET  http://127.0.0.1:8123/copilotkit (v2 info)
 *   GET  /api/copilotkit/info  → GET  http://127.0.0.1:8123/copilotkit (v2 info)
 *   POST /api/copilotkit/agent/:id/run → POST http://127.0.0.1:8123/:id (v1 exec)
 */
const BACKEND_URL = "http://127.0.0.1:8123";

const runtime = new CopilotRuntime({
  agents: {
    "openai-read-only": new HttpAgent({ url: `${BACKEND_URL}/openai-read-only` }),
    "openai-balanced": new HttpAgent({ url: `${BACKEND_URL}/openai-balanced` }),
    "openai-full-access": new HttpAgent({ url: `${BACKEND_URL}/openai-full-access` }),
  },
});

const runtimeHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Agent run: POST /api/copilotkit/agent/:id/run → POST http://127.0.0.1:8123/:id
  const agentMatch = path.match(/^\/api\/copilotkit\/agent\/([^/]+)\/run$/);
  if (request.method === "POST" && agentMatch) {
    const agentId = agentMatch[1];
    const backendUrl = `${BACKEND_URL}/${agentId}`;
    const headers = new Headers(request.headers);
    headers.delete("host");

    try {
      const backendResponse = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: await request.text(),
        // @ts-expect-error
        duplex: "half",
      });

      return new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Backend unreachable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Everything else → delegate to Runtime handler (info, etc.)
  return runtimeHandler(request);
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
