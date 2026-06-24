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
  return Object.fromEntries(
    catalog.presets.map((preset) => [
      preset.id,
      new LangGraphHttpAgent({
        url: buildRemoteAgentUrl(baseUrl, preset.id),
      }),
    ]),
  );
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
