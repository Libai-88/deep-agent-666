"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_AGENT_PRESET_ID,
  type PermissionMode,
  type ProviderKey,
  resolvePresetId,
} from "@/lib/agent-presets";
import {
  createLocalThread,
  loadThreads,
  saveThreads,
} from "@/lib/thread-registry";
import { InterruptApproval } from "./interrupt-approval";
import { SettingsPanel } from "./settings-panel";
import { ThreadSidebar } from "./thread-sidebar";
import { ToolCallRenderers } from "./tool-call-renderers";

function parsePresetId(presetId: string): {
  provider: ProviderKey;
  permissionMode: PermissionMode;
} {
  const separatorIndex = presetId.indexOf("-");

  return {
    provider: presetId.slice(0, separatorIndex) as ProviderKey,
    permissionMode: presetId.slice(separatorIndex + 1) as PermissionMode,
  };
}

export function AgentWorkbench() {
  const [initialState] = useState(() => {
    const storedThreads =
      typeof window === "undefined" ? [] : loadThreads(window.localStorage);
    const threads =
      storedThreads.length > 0
        ? storedThreads
        : [createLocalThread(DEFAULT_AGENT_PRESET_ID)];
    const activeThread = threads[0];
    const { provider, permissionMode } = parsePresetId(activeThread.presetId);

    return {
      threads,
      activeThreadId: activeThread.id,
      provider,
      permissionMode,
    };
  });
  const [threads, setThreads] = useState(initialState.threads);
  const [activeThreadId, setActiveThreadId] = useState(initialState.activeThreadId);
  const [provider, setProvider] = useState<ProviderKey>(initialState.provider);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    initialState.permissionMode,
  );

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );

  const currentPresetId = resolvePresetId(provider, permissionMode);

  function appendThread(presetId: ReturnType<typeof resolvePresetId>) {
    const nextThread = createLocalThread(presetId);
    const nextPreset = parsePresetId(presetId);

    setThreads((previous) => [nextThread, ...previous]);
    setActiveThreadId(nextThread.id);
    setProvider(nextPreset.provider);
    setPermissionMode(nextPreset.permissionMode);
  }

  function selectThread(threadId: string) {
    const selectedThread = threads.find((thread) => thread.id === threadId);

    if (!selectedThread) {
      return;
    }

    const nextPreset = parsePresetId(selectedThread.presetId);

    setActiveThreadId(threadId);
    setProvider(nextPreset.provider);
    setPermissionMode(nextPreset.permissionMode);
  }

  return (
    <main
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        minHeight: "100vh",
      }}
    >
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThread.id}
        onSelectThread={selectThread}
        onCreateThread={() => {
          appendThread(currentPresetId);
        }}
      />
      <section style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Assistant</h1>
        <SettingsPanel
          provider={provider}
          permissionMode={permissionMode}
          onProviderChange={(nextProvider) => {
            const nextPresetId = resolvePresetId(nextProvider, permissionMode);

            if (activeThread.presetId === nextPresetId) {
              setProvider(nextProvider);
              return;
            }

            appendThread(nextPresetId);
          }}
          onPermissionModeChange={(nextPermissionMode) => {
            const nextPresetId = resolvePresetId(provider, nextPermissionMode);

            if (activeThread.presetId === nextPresetId) {
              setPermissionMode(nextPermissionMode);
              return;
            }

            appendThread(nextPresetId);
          }}
        />
        <ToolCallRenderers />
        <InterruptApproval />
        <div
          style={{
            height: "calc(100vh - 180px)",
            border: "1px solid var(--line)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <CopilotChat agentId={activeThread.presetId} threadId={activeThread.id} />
        </div>
      </section>
    </main>
  );
}
