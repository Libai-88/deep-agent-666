import ReactDOMClient from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentWorkbench } from "../agent-workbench";

const copilotChatSpy = vi.fn();
const useInterruptSpy = vi.fn();
const useDefaultRenderToolSpy = vi.fn();
const useRenderToolSpy = vi.fn();

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
    window.localStorage.clear();
    document.body.innerHTML = "";
  });

  it("renders the shell labels and wires an explicit thread id into CopilotChat", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOMClient.createRoot(container);

    act(() => {
      root.render(<AgentWorkbench />);
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
      root.render(<AgentWorkbench />);
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
});
