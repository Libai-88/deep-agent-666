import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AGENT_BASE_URL;
});

describe("provider-probe route", () => {
  it("proxies provider probe requests to the backend", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ready",
          code: null,
          message: "ok",
          providerId: "lab-gateway",
          modelId: "lab-gpt5",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    process.env.AGENT_BASE_URL = "http://127.0.0.1:8123";
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://127.0.0.1:3000/api/provider-probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerProfile: { id: "lab-gateway" },
          modelProfile: { id: "lab-gpt5" },
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8123/providers/probe",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerProfile: { id: "lab-gateway" },
          modelProfile: { id: "lab-gpt5" },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      code: null,
      message: "ok",
      providerId: "lab-gateway",
      modelId: "lab-gpt5",
    });
  });
});
