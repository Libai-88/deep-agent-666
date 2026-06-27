import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/runtime-agents", () => ({
  loadRuntimeCatalog: vi.fn(),
}));
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AGENT_BASE_URL;
});

describe("runtime-diagnostics route", () => {
  it("returns a healthy live diagnostics snapshot", async () => {
    const { loadRuntimeCatalog } = await import("@/lib/runtime-agents");
    vi.mocked(loadRuntimeCatalog).mockResolvedValue({
      source: "live",
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

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workspaceRoot: "D:\\AgentBuild",
            providers: {
              openai: {
                configured: true,
                baseUrl: "https://api.openai.com/v1",
              },
              anthropic: {
                configured: false,
                baseUrl: null,
              },
              google: {
                configured: false,
                baseUrl: null,
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    const { GET } = await import("./route");

    const response = await GET();
    expect(await response.json()).toMatchObject({
      status: "healthy",
      backendReachable: true,
      catalogSource: "live",
      launchablePresetCount: 1,
      configuredProviderCount: 1,
      workspaceRoot: "D:\\AgentBuild",
    });
  });

  it("returns degraded when only fallback presets remain after backend loss", async () => {
    const { loadRuntimeCatalog } = await import("@/lib/runtime-agents");
    vi.mocked(loadRuntimeCatalog).mockResolvedValue({
      source: "fallback",
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

    fetchMock.mockRejectedValue(new Error("backend offline"));

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    const { GET } = await import("./route");

    const response = await GET();
    expect(await response.json()).toMatchObject({
      status: "degraded",
      backendReachable: false,
      catalogSource: "fallback",
      launchablePresetCount: 1,
      configuredProviderCount: 0,
    });
  });
});
