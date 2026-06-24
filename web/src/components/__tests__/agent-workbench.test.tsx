import ReactDOMClient from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentWorkbench } from "../agent-workbench";

const DEFAULT_CATALOG = {
  defaultPresetId: "openai-balanced" as const,
  presets: [
    {
      id: "openai-balanced" as const,
      label: "OpenAI / Balanced",
      provider: "openai" as const,
      permissionMode: "balanced" as const,
    },
    {
      id: "google-read-only" as const,
      label: "Google / Read-only",
      provider: "google" as const,
      permissionMode: "read-only" as const,
    },
    {
      id: "google-balanced" as const,
      label: "Google / Balanced",
      provider: "google" as const,
      permissionMode: "balanced" as const,
    },
  ],
};

const copilotChatSpy = vi.fn();
const useInterruptSpy = vi.fn();
const useDefaultRenderToolSpy = vi.fn();
const useRenderToolSpy = vi.fn();
const { fetchCatalogStateFromUrlMock } = vi.hoisted(() => ({
  fetchCatalogStateFromUrlMock: vi.fn(),
}));

fetchCatalogStateFromUrlMock.mockResolvedValue({
  catalog: DEFAULT_CATALOG,
  source: "fallback",
});

vi.mock("@/lib/preset-catalog", () => ({
  fetchCatalogStateFromUrl: fetchCatalogStateFromUrlMock,
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  CopilotChat: (props: { agentId: string; threadId: string }) => {
    copilotChatSpy(props);
    return (
      <div data-agent-id={props.agentId} data-testid="copilot-chat">
        {props.threadId}
      </div>
    );
  },
  useInterrupt: (...args: unknown[]) => useInterruptSpy(...args),
  useDefaultRenderTool: (...args: unknown[]) =>
    useDefaultRenderToolSpy(...args),
  useRenderTool: (...args: unknown[]) => useRenderToolSpy(...args),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("AgentWorkbench", () => {
  afterEach(() => {
    copilotChatSpy.mockClear();
    useInterruptSpy.mockClear();
    useDefaultRenderToolSpy.mockClear();
    useRenderToolSpy.mockClear();
    fetchCatalogStateFromUrlMock.mockReset();
    fetchCatalogStateFromUrlMock.mockResolvedValue({
      catalog: DEFAULT_CATALOG,
      source: "fallback",
    });
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("renders the shell labels and wires an explicit thread id into CopilotChat", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(
        <AgentWorkbench catalog={DEFAULT_CATALOG} initialSource="live" />,
      );
    });

    expect(container.textContent).toContain("Threads");
    expect(container.textContent).toContain("Assistant");
    expect(copilotChatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "openai-balanced",
        threadId: expect.any(String),
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("reuses the selected persisted thread instead of replacing it when presets differ", () => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: "thread-openai",
          title: "OpenAI thread",
          presetId: "openai-balanced",
          updatedAt: 2,
        },
        {
          id: "thread-google",
          title: "Google thread",
          presetId: "google-balanced",
          updatedAt: 1,
        },
      ]),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(
        <AgentWorkbench catalog={DEFAULT_CATALOG} initialSource="live" />,
      );
    });

    const googleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Google thread"),
    );

    expect(googleButton).toBeDefined();

    act(() => {
      googleButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(copilotChatSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentId: "google-balanced",
        threadId: "thread-google",
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("uses the backend default preset id when there are no persisted threads", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(
        <AgentWorkbench
          catalog={{
            defaultPresetId: "google-read-only",
            presets: DEFAULT_CATALOG.presets,
          }}
          initialSource="live"
        />,
      );
    });

    expect(copilotChatSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentId: "google-read-only",
        threadId: expect.any(String),
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("drops persisted threads whose presets are no longer exposed by the backend", () => {
    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: "thread-openai",
          title: "OpenAI thread",
          presetId: "openai-balanced",
          updatedAt: 2,
        },
      ]),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(
        <AgentWorkbench
          catalog={{
            defaultPresetId: "google-balanced",
            presets: DEFAULT_CATALOG.presets.filter(
              (preset) => preset.provider === "google",
            ),
          }}
          initialSource="live"
        />,
      );
    });

    expect(copilotChatSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentId: "google-balanced",
        threadId: expect.any(String),
      }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("shows an offline placeholder before the live catalog arrives", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(
        <AgentWorkbench
          catalog={DEFAULT_CATALOG}
          initialSource="fallback"
        />,
      );
    });

    expect(container.textContent).toContain("Backend is offline");
    expect(copilotChatSpy).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
  });

  it("refreshes from fallback to the live backend catalog before mounting chat", async () => {
    fetchCatalogStateFromUrlMock.mockResolvedValueOnce({
      source: "live" as const,
      catalog: {
        defaultPresetId: "google-balanced" as const,
        presets: DEFAULT_CATALOG.presets.filter(
          (preset) => preset.provider === "google",
        ),
      },
    });

    window.localStorage.setItem(
      "deep-agent-666.threads",
      JSON.stringify([
        {
          id: "thread-openai",
          title: "OpenAI thread",
          presetId: "openai-balanced",
          updatedAt: 2,
        },
      ]),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOMClient.createRoot(container);

    await act(async () => {
      root.render(
        <AgentWorkbench
          catalog={DEFAULT_CATALOG}
          initialSource="fallback"
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Threads");
    expect(container.textContent).not.toContain("Backend is offline");
    expect(copilotChatSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentId: "google-balanced",
        threadId: expect.any(String),
      }),
    );

    act(() => {
      root.unmount();
    });
  });
});
