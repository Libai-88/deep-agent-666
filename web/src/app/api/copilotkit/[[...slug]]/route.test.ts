import { afterEach, describe, expect, it, vi } from "vitest";

const createCopilotRuntimeHandler = vi.fn(() => vi.fn());
const sqliteAgentRunnerInstances: Array<{ options: Record<string, unknown> }> = [];
const copilotRuntimeInstances: Array<{ options: Record<string, unknown> }> = [];
const loadRuntimeCatalog = vi.fn();
const buildRuntimeAgents = vi.fn();
const resolveMcpAppsConfig = vi.fn();

vi.mock("@/lib/copilotkit-runtime-v2", () => ({
  CopilotRuntime: class {
    constructor(public options: Record<string, unknown>) {
      copilotRuntimeInstances.push(this);
    }
  },
  createCopilotRuntimeHandler,
}));

vi.mock("@copilotkit/sqlite-runner", () => ({
  SqliteAgentRunner: class {
    constructor(public options: Record<string, unknown>) {
      sqliteAgentRunnerInstances.push(this);
    }
  },
}));

vi.mock("@/lib/runtime-agents", () => ({
  loadRuntimeCatalog,
  buildRuntimeAgents,
}));

vi.mock("@/lib/runtime-config", () => ({
  resolveMcpAppsConfig,
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sqliteAgentRunnerInstances.length = 0;
  copilotRuntimeInstances.length = 0;
  delete process.env.AGENT_BASE_URL;
  delete process.env.COPILOTKIT_THREADS_DB_PATH;
  delete process.env.MCP_SERVER_URL;
});

describe("copilotkit route runtime", () => {
  it("builds a sqlite-backed runtime handler with an explicit db path", async () => {
    loadRuntimeCatalog.mockResolvedValue({
      catalog: {
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      },
    });
    buildRuntimeAgents.mockReturnValue({ default: { id: "default-agent" } });
    resolveMcpAppsConfig.mockReturnValue({
      servers: [{ type: "http", url: "http://127.0.0.1:8787", serverId: "workspace-tools" }],
    });
    process.env.COPILOTKIT_THREADS_DB_PATH = "./tmp/e2e-threads.db";
    process.env.MCP_SERVER_URL = "http://127.0.0.1:8787";

    const { GET } = await import("./route");
    await GET(new Request("http://127.0.0.1:3000/api/copilotkit/info"));

    expect(sqliteAgentRunnerInstances).toHaveLength(1);
    expect(sqliteAgentRunnerInstances[0]?.options).toEqual({
      dbPath: "./tmp/e2e-threads.db",
    });

    expect(copilotRuntimeInstances).toHaveLength(1);
    expect(copilotRuntimeInstances[0]?.options).toMatchObject({
      agents: { default: { id: "default-agent" } },
      runner: sqliteAgentRunnerInstances[0],
      a2ui: {},
      openGenerativeUI: true,
      mcpApps: {
        servers: [{ type: "http", url: "http://127.0.0.1:8787", serverId: "workspace-tools" }],
      },
    });

    expect(createCopilotRuntimeHandler).toHaveBeenCalledWith({
      runtime: copilotRuntimeInstances[0],
      basePath: "/api/copilotkit",
    });
  });

  it("defaults the sqlite runner path to the local data directory", async () => {
    loadRuntimeCatalog.mockResolvedValue({
      catalog: {
        defaultPresetId: "openai-balanced",
        presets: [
          {
            id: "openai-balanced",
            label: "OpenAI / Balanced",
            provider: "openai",
            permissionMode: "balanced",
          },
        ],
      },
    });
    buildRuntimeAgents.mockReturnValue({ default: { id: "default-agent" } });
    resolveMcpAppsConfig.mockReturnValue(undefined);

    const { GET } = await import("./route");
    await GET(new Request("http://127.0.0.1:3000/api/copilotkit/info"));

    expect(sqliteAgentRunnerInstances).toHaveLength(1);
    expect(sqliteAgentRunnerInstances[0]?.options).toEqual({
      dbPath: "./data/threads.db",
    });
  });
});
