import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import { STATIC_AGENT_PRESET_CATALOG } from "@/lib/agent-presets";
import { createRuntimeFromCatalog } from "@/lib/copilot-runtime";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_THREADS_DB_PATH = "./data/threads.db";

const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
const dbPath =
  process.env.COPILOTKIT_THREADS_DB_PATH ?? DEFAULT_THREADS_DB_PATH;

const handler = createCopilotRuntimeHandler({
  runtime: createRuntimeFromCatalog(STATIC_AGENT_PRESET_CATALOG, baseUrl, dbPath),
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
