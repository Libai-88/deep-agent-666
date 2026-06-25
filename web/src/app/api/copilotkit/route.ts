import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import { STATIC_AGENT_PRESET_CATALOG } from "@/lib/agent-presets";
import { createRuntimeFromCatalog } from "@/lib/copilot-runtime";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_THREADS_DB_PATH = "./data/threads.db";

const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
const dbPath =
  process.env.COPILOTKIT_THREADS_DB_PATH ?? DEFAULT_THREADS_DB_PATH;

const runtime = createRuntimeFromCatalog(STATIC_AGENT_PRESET_CATALOG, baseUrl, dbPath);
const runtimeHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

/** Intercept agent discovery GET requests.
 * All other GET/POST requests → Runtime handler. */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Only intercept agent discovery (root / and /info)
  if (request.method === "GET" && (path === "/api/copilotkit" || path === "/api/copilotkit/")) {
    const backendInfo = await fetch(`${DEFAULT_AGENT_BASE_URL}/copilotkit/`, {
      headers: { Accept: "application/json" },
    });
    if (backendInfo.ok) {
      const backendData = await backendInfo.json();
      const agentArray: Array<{ name: string }> = backendData.agents ?? [];
      const agentObj: Record<string, unknown> = {};
      for (const a of agentArray) {
        agentObj[a.name] = a;
      }
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

  // Everything else → Runtime handler (agent run, connect, stop, etc.)
  return runtimeHandler(request);
}

export const GET = handler;
export const POST = handler;
