import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

import { STATIC_AGENT_PRESET_CATALOG } from "@/lib/agent-presets";
import type { AgentPresetCatalog } from "@/lib/agent-presets";

/** Build agents mapping matching the official langgraph-fastapi pattern. */
function buildAgents(catalog: AgentPresetCatalog) {
  const baseUrl = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";
  const agents: Record<string, LangGraphHttpAgent> = {};

  for (const preset of catalog.presets) {
    agents[preset.id] = new LangGraphHttpAgent({
      url: `${baseUrl}/${preset.id}`,
    });
    agents[`coordinator-${preset.id}`] = new LangGraphHttpAgent({
      url: `${baseUrl}/coordinator-${preset.id}`,
    });
  }

  // Alias "default" for CopilotChat auto-detection
  const defaultId = catalog.defaultPresetId ?? catalog.presets[0]?.id;
  if (defaultId && agents[defaultId]) {
    agents.default = agents[defaultId];
  }

  return agents;
}

const runtime = new CopilotRuntime({
  agents: buildAgents(STATIC_AGENT_PRESET_CATALOG),
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
