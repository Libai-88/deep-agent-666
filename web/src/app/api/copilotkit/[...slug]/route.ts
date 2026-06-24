import { getRuntimeState } from "@/lib/runtime-state";

export const runtime = "nodejs";

async function handleRequest(request: Request) {
  const state = await getRuntimeState();
  return state.handler(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const OPTIONS = handleRequest;
