import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AGENT_BASE_URL;
});

describe("runtime-config route", () => {
  it("proxies the backend runtime config snapshot", async () => {
    fetchMock.mockResolvedValue(
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

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8123/config",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
    expect(await response.json()).toEqual({
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
    });
  });

  it("forwards workspace-root saves and preserves backend validation errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "workspace root does not exist",
          code: "workspace_root_invalid",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/runtime-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_workspace_root: "D:\\Missing",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8123/configure",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_workspace_root: "D:\\Missing",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      detail: "workspace root does not exist",
      code: "workspace_root_invalid",
    });
  });

  it("returns a normalized empty runtime snapshot when the backend config endpoint is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workspaceRoot: null,
      providers: {
        openai: {
          configured: false,
          baseUrl: null,
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
    });
  });
});
