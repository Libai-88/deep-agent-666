import { getRuntimeState } from "@/lib/runtime-state";

async function handleRequest(request: Request) {
  const state = await getRuntimeState();
  return state.handler(request);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const OPTIONS = handleRequest;
