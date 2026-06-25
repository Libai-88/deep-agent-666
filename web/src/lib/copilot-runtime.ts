import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { SqliteAgentRunner } from "@copilotkit/sqlite-runner";

import {
  type AgentPresetCatalog,
  type AgentPresetId,
} from "./agent-presets";
import { fetchPresetCatalog } from "./preset-catalog";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_THREADS_DB_PATH = "./data/threads.db";

export function buildRemoteAgentUrl(
  baseUrl: string,
  presetId: AgentPresetId,
): string {
  return `${baseUrl.replace(/\/$/, "")}/${presetId}`;
}

export function createRemoteAgents(
  baseUrl: string,
  catalog: AgentPresetCatalog,
): Record<string, LangGraphHttpAgent> {
  const agents: Record<string, LangGraphHttpAgent> = {};
  const defaultPresetId = catalog.defaultPresetId ?? catalog.presets[0]?.id;

  for (const preset of catalog.presets) {
    agents[preset.id] = new LangGraphHttpAgent({
      url: buildRemoteAgentUrl(baseUrl, preset.id),
    });
    // Add coordinator endpoint for this preset
    agents[`coordinator-${preset.id}`] = new LangGraphHttpAgent({
      url: `${baseUrl.replace(/\/$/, "")}/coordinator-${preset.id}`,
    });
  }

  // CopilotKit uses "default" as the internal agent ID when none is specified.
  // Alias it to the catalog's default preset so the provider sync succeeds.
  if (defaultPresetId && !agents["default"]) {
    agents["default"] = agents[defaultPresetId];
  }

  return agents;
}

export function createRuntimeFromCatalog(
  catalog: AgentPresetCatalog,
  baseUrl: string,
  dbPath: string,
) {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  return new CopilotRuntime({
    agents: createRemoteAgents(baseUrl, catalog),
    runner: new SqliteAgentRunner({
      dbPath,
    }),
  });
}

export async function createRuntime() {
  const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
  const dbPath =
    process.env.COPILOTKIT_THREADS_DB_PATH ?? DEFAULT_THREADS_DB_PATH;
  const catalog = await fetchPresetCatalog(baseUrl);

  return createRuntimeFromCatalog(catalog, baseUrl, dbPath);
}
