import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

const BACKEND_URL = "http://127.0.0.1:8123";

const runtime = new CopilotRuntime({
  agents: {
    "default": new HttpAgent({ url: `${BACKEND_URL}/openai-balanced` }),
    "openai-read-only": new HttpAgent({ url: `${BACKEND_URL}/openai-read-only` }),
    "openai-balanced": new HttpAgent({ url: `${BACKEND_URL}/openai-balanced` }),
    "openai-full-access": new HttpAgent({ url: `${BACKEND_URL}/openai-full-access` }),
  },
});

const runtimeHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

/** The CopilotKit browser provider sends GET /api/copilotkit for discovery.
 *  The backend CopilotKitRemoteEndpoint returns agents as an array, but the
 *  CopilotKit provider expects agents as an object {name: {...}} with "default" key. */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && !url.pathname.includes("/info")) {
    const backendInfo = await fetch(`${BACKEND_URL}/copilotkit/`, {
      headers: { Accept: "application/json" },
    });
    const backendData = await backendInfo.json();
    const agentArray = backendData.agents ?? [];
    const agentObject: Record<string, unknown> = {};
    for (const a of agentArray) {
      agentObject[a.name] = a;
    }
    if (!agentObject.default && agentObject["openai-balanced"]) {
      agentObject.default = { ...agentObject["openai-balanced"], name: "default", description: "Default agent" };
    }
    return Response.json({
      actions: backendData.actions ?? [],
      agents: agentObject,
      sdkVersion: backendData.sdkVersion ?? "0.1.94",
      mode: "sse",
    });
  }
  return runtimeHandler(request);
}

export const GET = handler;
export const POST = runtimeHandler;