import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import { createRuntime } from "@/lib/copilot-runtime";

export const runtime = "nodejs";

let handler:
  | ReturnType<typeof createCopilotRuntimeHandler>
  | undefined;

function getHandler() {
  if (!handler) {
    handler = createCopilotRuntimeHandler({
      runtime: createRuntime(),
      basePath: "/api/copilotkit",
      cors: true,
    });
  }

  return handler;
}

async function handleRequest(request: Request) {
  return getHandler()(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const OPTIONS = handleRequest;
