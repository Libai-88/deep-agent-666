import { A2AMiddlewareAgent } from "@ag-ui/a2a-middleware";
import type { AbstractAgent } from "@ag-ui/client";
import { HttpAgent } from "@ag-ui/client";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

import type { AgentPresetCatalog } from "./agent-presets";
import { fetchPresetCatalog } from "./preset-catalog";

export type RuntimeCatalogState = {
  catalog: AgentPresetCatalog;
  source: "live" | "fallback";
};

const EMPTY_CATALOG: AgentPresetCatalog = {
  defaultPresetId: null,
  presets: [],
};

export function buildRuntimeAgents(
  catalog: AgentPresetCatalog,
  baseUrl: string,
): Record<string, AbstractAgent> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const agents: Record<string, AbstractAgent> = {};

  for (const preset of catalog.presets) {
    agents[preset.id] = new LangGraphHttpAgent({
      url: `${normalizedBaseUrl}/${preset.id}`,
    });

    if (preset.permissionMode !== "read-only") {
      agents[`coordinator-${preset.id}`] = new LangGraphHttpAgent({
        url: `${normalizedBaseUrl}/coordinator-${preset.id}`,
      });
    }
  }

  const defaultId = catalog.defaultPresetId ?? catalog.presets[0]?.id;
  if (defaultId && agents[defaultId]) {
    agents.default = agents[defaultId];
  }

  if (
    process.env.ENABLE_A2A_RESEARCH === "true" &&
    agents["openai-balanced"] &&
    agents["coordinator-openai-balanced"]
  ) {
    agents["a2a-research"] = new A2AMiddlewareAgent({
      agentId: "a2a-research",
      description: "Multi-agent research via A2A protocol",
      agentUrls: [`${normalizedBaseUrl}/coordinator-openai-balanced`],
      instructions: `
        You are a multi-agent research coordinator.
        Delegate work to available specialized agents and synthesize results.
        Call agents ONE AT A TIME. Never make parallel calls.
      `,
      orchestrationAgent: new HttpAgent({
        url: `${normalizedBaseUrl}/openai-balanced`,
      }),
    });
  }

  return agents;
}

export async function loadRuntimeCatalog(
  baseUrl: string,
): Promise<RuntimeCatalogState> {
  try {
    const catalog = await fetchPresetCatalog(baseUrl, { cache: "no-store" });
    return {
      catalog,
      source: "live",
    };
  } catch {
    return {
      catalog: EMPTY_CATALOG,
      source: "fallback",
    };
  }
}
