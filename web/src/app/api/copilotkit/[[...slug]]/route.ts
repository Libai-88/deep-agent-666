import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

import { buildRuntimeAgents, loadRuntimeCatalog } from "@/lib/runtime-agents";

const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";
const runner = new InMemoryAgentRunner();

let cachedHandler: ReturnType<typeof createCopilotRuntimeHandler> | null = null;
let cachedCatalogKey = "";

function createRuntimeHandler(catalogKey: string, runtime: CopilotRuntime) {
  cachedCatalogKey = catalogKey;
  cachedHandler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
  });
  return cachedHandler;
}

async function getHandler() {
  const { catalog } = await loadRuntimeCatalog(BACKEND_URL);
  const catalogKey = [
    catalog.defaultPresetId ?? "",
    ...catalog.presets.map((preset) => preset.id),
  ].join("|");

  if (cachedHandler && cachedCatalogKey === catalogKey) {
    return cachedHandler;
  }

  const runtime = new CopilotRuntime({
    agents: buildRuntimeAgents(catalog, BACKEND_URL),
    runner,
    a2ui: {},
    openGenerativeUI: true,
    mcpApps: {
      servers: [
        {
          type: "http" as const,
          url: process.env.MCP_SERVER_URL || "http://localhost:3108/mcp",
          serverId: "workspace-tools",
        },
      ],
    },
  });

  return createRuntimeHandler(catalogKey, runtime);
}

async function handle(request: Request) {
  const handler = await getHandler();
  return handler(request);
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  return handle(request);
}
