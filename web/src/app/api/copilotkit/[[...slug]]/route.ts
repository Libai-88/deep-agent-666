import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import type { AbstractAgent } from "@ag-ui/client";
import { HttpAgent } from "@ag-ui/client";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { A2AMiddlewareAgent } from "@ag-ui/a2a-middleware";

import { STATIC_AGENT_PRESET_CATALOG } from "@/lib/agent-presets";
import type { AgentPresetCatalog } from "@/lib/agent-presets";

const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";

/** Build agents mapping for the CopilotRuntime. */
function buildAgents(catalog: AgentPresetCatalog): Record<string, AbstractAgent> {
  const agents: Record<string, AbstractAgent> = {};

  for (const preset of catalog.presets) {
    agents[preset.id] = new LangGraphHttpAgent({
      url: `${BACKEND_URL}/${preset.id}`,
    });
    agents[`coordinator-${preset.id}`] = new LangGraphHttpAgent({
      url: `${BACKEND_URL}/coordinator-${preset.id}`,
    });
  }

  // Alias "default" for CopilotChat auto-detection
  const defaultId = catalog.defaultPresetId ?? catalog.presets[0]?.id;
  if (defaultId && agents[defaultId]) {
    agents.default = agents[defaultId];
  }

  // A2A multi-agent research coordinator
  agents["a2a-research"] = new A2AMiddlewareAgent({
    agentId: "a2a-research",
    description: "Multi-agent research: delegates to plan/execute/review sub-agents",
    agentUrls: [
      `${BACKEND_URL}/coordinator-openai-balanced`,
    ],
    instructions: `
      You are a multi-agent research coordinator.
      Delegate work to available specialized agents and synthesize results.
      Call agents ONE AT A TIME. Never make parallel calls.
    `,
    orchestrationAgent: new HttpAgent({
      url: `${BACKEND_URL}/openai-balanced`,
    }),
  });

  return agents;
}

const agents = buildAgents(STATIC_AGENT_PRESET_CATALOG);

// Register A2A multi-agent coordinator that delegates to sub-agents
// running in separate Python processes (reference: examples/integrations/a2a-middleware)
agents["a2a-research"] = new A2AMiddlewareAgent({
  agentId: "a2a-research",
  description: "Multi-agent research: delegates to plan/execute/review sub-agents",
  agentUrls: [
    `${BACKEND_URL}/coordinator-openai-balanced`,
  ],
  instructions: `
    You are a multi-agent research coordinator.
    Delegate work to available specialized agents and synthesize results.
    Call agents ONE AT A TIME. Never make parallel calls.
  `,
  orchestrationAgent: new HttpAgent({
    url: `${BACKEND_URL}/openai-balanced`,
  }),
});

const runtime = new CopilotRuntime({
  agents,
  runner: new InMemoryAgentRunner(),
  a2ui: {},
  openGenerativeUI: true,
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
