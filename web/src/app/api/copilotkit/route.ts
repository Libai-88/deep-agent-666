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
 *  The backend CopilotKitRemoteEndpoint responds to /copilotkit/ (with slash)
 *  with agents as an array. We inject a "default" alias pointing to openai-balanced
 *  so the browser CopilotKit provider doesn't throw "Agent 'default' not found". */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && !url.pathname.includes("/info")) {
    const backendInfo = await fetch(`${BACKEND_URL}/copilotkit/`, {
      headers: { Accept: "application/json" },
    });
    const backendData = await backendInfo.json();
    // Inject default agent alias
    const agents = backendData.agents ?? [];
    const defaultAgent = agents.find((a: any) => a.name === "openai-balanced");
    const augmented = {
      ...backendData,
      agents: [
        { ...(defaultAgent ?? {}), name: "default", description: "Default agent" },
        ...agents,
      ],
    };
    return Response.json(augmented);
  }
  return runtimeHandler(request);
}

export const GET = handler;
export const POST = runtimeHandler;