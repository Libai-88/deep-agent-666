import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.AGENT_BASE_URL;
});

describe("runtime-control route", () => {
  it("proxies canonical run control actions to the backend and returns runtime_control", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          threadId: "thread-1",
          action: "request_stop",
          runtime_control: {
            phase: "cancellation_requested",
            reason: "user_stop",
            available_actions: [],
            status_message: "Cancellation requested",
          },
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
          action: "request_stop",
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
          action: "request_stop",
        }),
      }),
    );
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      runtime_control: { phase: "cancellation_requested" },
    });
  });
});
