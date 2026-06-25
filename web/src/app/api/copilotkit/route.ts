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

export const GET = runtimeHandler;
export const POST = runtimeHandler;

