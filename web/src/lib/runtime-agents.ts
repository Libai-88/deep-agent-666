import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { A2AMiddlewareAgent } from "@ag-ui/a2a-middleware";
import type { AbstractAgent } from "@ag-ui/client";
import { HttpAgent } from "@ag-ui/client";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

import type { AgentPresetCatalog } from "./agent-presets";
import { fetchPresetCatalog, normalizePresetCatalog } from "./preset-catalog";

export type RuntimeCatalogState = {
  catalog: AgentPresetCatalog;
  source: "live" | "fallback";
};

const EMPTY_CATALOG: AgentPresetCatalog = {
  defaultPresetId: null,
  presets: [],
};
const DEFAULT_RUNTIME_CATALOG_PATH = "./data/runtime-catalog.json";

function resolveRuntimeCatalogCachePath() {
  return (
    process.env.COPILOTKIT_RUNTIME_CATALOG_PATH ??
    DEFAULT_RUNTIME_CATALOG_PATH
  );
}

function readCachedRuntimeCatalog(
  cachePath: string,
): AgentPresetCatalog | null {
  try {
    if (!existsSync(cachePath)) {
      return null;
    }

    const payload = JSON.parse(readFileSync(cachePath, "utf8")) as unknown;
    return normalizePresetCatalog(payload);
  } catch {
    return null;
  }
}

function writeCachedRuntimeCatalog(
  cachePath: string,
  catalog: AgentPresetCatalog,
) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(catalog, null, 2), "utf8");
}

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
  const cachePath = resolveRuntimeCatalogCachePath();

  try {
    const catalog = await fetchPresetCatalog(baseUrl, { cache: "no-store" });
    writeCachedRuntimeCatalog(cachePath, catalog);

    return {
      catalog,
      source: "live",
    };
  } catch {
    const cachedCatalog = readCachedRuntimeCatalog(cachePath);
    if (cachedCatalog) {
      return {
        catalog: cachedCatalog,
        source: "fallback",
      };
    }

    return {
      catalog: EMPTY_CATALOG,
      source: "fallback",
    };
  }
}
