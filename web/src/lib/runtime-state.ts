import { createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import {
  STATIC_AGENT_PRESET_CATALOG,
  type AgentPresetCatalog,
} from "./agent-presets";
import { createRuntimeFromCatalog } from "./copilot-runtime";
import { fetchPresetCatalog } from "./preset-catalog";

const DEFAULT_AGENT_BASE_URL = "http://127.0.0.1:8123";
const DEFAULT_THREADS_DB_PATH = "./data/threads.db";

type RuntimeState = {
  catalog: AgentPresetCatalog;
  handler: ReturnType<typeof createCopilotRuntimeHandler>;
  signature: string;
  source: "live";
};

type CatalogState =
  | RuntimeState
  | {
      catalog: AgentPresetCatalog;
      source: "fallback";
    };

let runtimeState: RuntimeState | undefined;

function catalogSignature(catalog: AgentPresetCatalog): string {
  return JSON.stringify({
    defaultPresetId: catalog.defaultPresetId,
    presetIds: catalog.presets.map((preset) => preset.id),
  });
}

function buildRuntimeState(catalog: AgentPresetCatalog): RuntimeState {
  const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
  const dbPath =
    process.env.COPILOTKIT_THREADS_DB_PATH ?? DEFAULT_THREADS_DB_PATH;

  return {
    catalog,
    handler: createCopilotRuntimeHandler({
      runtime: createRuntimeFromCatalog(catalog, baseUrl, dbPath),
      basePath: "/api/copilotkit",
      cors: true,
    }),
    signature: catalogSignature(catalog),
    source: "live",
  };
}

export async function getRuntimeState(): Promise<RuntimeState> {
  const baseUrl = process.env.AGENT_BASE_URL ?? DEFAULT_AGENT_BASE_URL;
  try {
    const catalog = await fetchPresetCatalog(baseUrl, {
      cache: "no-store",
    });
    const signature = catalogSignature(catalog);

    if (runtimeState && runtimeState.signature === signature) {
      return runtimeState;
    }

    runtimeState = buildRuntimeState(catalog);
    return runtimeState;
  } catch (error) {
    if (runtimeState) {
      return runtimeState;
    }

    throw error;
  }
}

export async function getCatalogState(): Promise<CatalogState> {
  try {
    return await getRuntimeState();
  } catch {
    return {
      catalog: STATIC_AGENT_PRESET_CATALOG,
      source: "fallback",
    };
  }
}
