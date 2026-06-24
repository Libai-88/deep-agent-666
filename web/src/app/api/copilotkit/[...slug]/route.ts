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

export async function GET(request: Request) {
  return getHandler()(request);
}

export async function POST(request: Request) {
  return getHandler()(request);
}

export async function OPTIONS(request: Request) {
  return getHandler()(request);
}
