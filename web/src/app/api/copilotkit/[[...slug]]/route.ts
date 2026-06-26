import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import { STATIC_AGENT_PRESET_CATALOG } from "@/lib/agent-presets";
import { createRemoteAgents } from "@/lib/copilot-runtime";

const BACKEND_URL = "http://127.0.0.1:8123";

/**
 * Create the CopilotRuntime with HttpAgent instances connecting to the
 * Python backend, plus SqliteAgentRunner for thread persistence.
 */
function buildRuntime() {
  const agents = createRemoteAgents(BACKEND_URL, STATIC_AGENT_PRESET_CATALOG);
  return new CopilotRuntime({ agents });
}

const runtime = buildRuntime();
const runtimeHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

/**
 * Route handler:
 *   GET  /api/copilotkit, /api/copilotkit/info → agent discovery (augmented with "default")
 *   POST /api/copilotkit/agent/:id/run          → proxy to Python backend (raw SSE)
 *   Other (connect, stop, state, etc.)          → CopilotKit Runtime handler
 */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Discovery: GET /api/copilotkit or GET /api/copilotkit/info
  if (request.method === "GET" && (path === "/api/copilotkit" || path === "/api/copilotkit/" || path.endsWith("/info"))) {
    const backendInfo = await fetch(`${BACKEND_URL}/copilotkit/`, {
      headers: { Accept: "application/json" },
    });
    if (backendInfo.ok) {
      const backendData = await backendInfo.json();
      const agentArray: Array<{ name: string }> = backendData.agents ?? [];
      const agentObj: Record<string, unknown> = {};
      for (const a of agentArray) agentObj[a.name] = a;
      if (!agentObj.default && agentObj["openai-balanced"]) {
        agentObj.default = agentObj["openai-balanced"];
      }
      return Response.json({
        version: "1.61.1",
        agents: agentObj,
        mode: "sse",
        threadEndpoints: { list: false, inspect: false, mutations: false, realtimeMetadata: false },
        a2uiEnabled: false,
        openGenerativeUIEnabled: false,
        telemetryDisabled: true,
        audioFileTranscriptionEnabled: false,
      });
    }
  }

  // Agent execution: POST /api/copilotkit/agent/:id/run → proxy to backend
  // Bypasses SqliteAgentRunner's finalizeRunEvents check to avoid INCOMPLETE_STREAM
  const agentMatch = path.match(/^\/api\/copilotkit\/agent\/([^/]+)\/run$/);
  if (request.method === "POST" && agentMatch) {
    const agentId = agentMatch[1];
    const backendUrl = `${BACKEND_URL}/${agentId}`;
    try {
      const backendResponse = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
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

  // Everything else → Runtime handler (connect, stop, state, etc.)
  return runtimeHandler(request);
}

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
