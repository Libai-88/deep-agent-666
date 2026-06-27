import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AGENT_BASE_URL;
});

describe("runtime-control route", () => {
  it("proxies stop actions to the backend control endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          threadId: "thread-1",
          action: "stop",
          runStatus: "stopped",
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
      new Request("http://127.0.0.1:3000/api/runtime-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id: "thread-1",
          action: "stop",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8123/control",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id: "thread-1",
          action: "stop",
        }),
      }),
    );
    expect(await response.json()).toEqual({
      status: "ok",
      threadId: "thread-1",
      action: "stop",
      runStatus: "stopped",
    });
  });
});
