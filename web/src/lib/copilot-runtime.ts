import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { SqliteAgentRunner } from "@copilotkit/sqlite-runner";

import { ALL_AGENT_PRESETS, type AgentPresetId } from "./agent-presets";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_THREADS_DB_PATH = "./data/threads.db";

export function buildRemoteAgentUrl(
  baseUrl: string,
  presetId: AgentPresetId,
): string {
  return `${baseUrl.replace(/\/$/, "")}/${presetId}`;
}

export function createRuntime() {
  const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
  const dbPath =
    process.env.COPILOTKIT_THREADS_DB_PATH ?? DEFAULT_THREADS_DB_PATH;

  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  return new CopilotRuntime({
    agents: Object.fromEntries(
      ALL_AGENT_PRESETS.map((preset) => [
        preset.id,
        new LangGraphHttpAgent({
          url: buildRemoteAgentUrl(baseUrl, preset.id),
        }),
      ]),
    ),
    runner: new SqliteAgentRunner({
      dbPath,
    }),
  });
}
