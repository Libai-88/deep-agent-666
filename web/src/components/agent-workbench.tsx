"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useState } from "react";

import {
  findPresetById,
  type AgentPresetCatalog,
  type AgentPresetDefinition,
  type PermissionMode,
  parsePresetId,
  resolveDefaultPresetId,
} from "@/lib/agent-presets";
import {
  fetchCatalogStateFromUrl,
  type CatalogSource,
} from "@/lib/preset-catalog";
import {
  createLocalThread,
  loadThreads,
  sanitizeThreads,
  saveThreads,
  type LocalThread,
} from "@/lib/thread-registry";
import { InterruptApproval } from "./interrupt-approval";
import { SettingsPanel } from "./settings-panel";
import { ThreadSidebar } from "./thread-sidebar";
import { ToolCallRenderers } from "./tool-call-renderers";

type AgentWorkbenchProps = {
  catalog: AgentPresetCatalog;
  initialSource?: CatalogSource;
};

function findPreset(
  presets: readonly AgentPresetDefinition[],
  provider: AgentPresetDefinition["provider"],
  permissionMode: PermissionMode,
) {
  return presets.find(
    (preset) =>
      preset.provider === provider && preset.permissionMode === permissionMode,
  );
}

function seedThreads(
  storedThreads: LocalThread[],
  catalog: AgentPresetCatalog,
): LocalThread[] {
  const threads = sanitizeThreads(storedThreads, catalog.presets);

  if (threads.length > 0) {
    return threads;
  }

  const defaultPresetId = resolveDefaultPresetId(catalog);

  return defaultPresetId ? [createLocalThread(defaultPresetId)] : [];
}

export function AgentWorkbench({
  catalog,
  initialSource = "live",
}: AgentWorkbenchProps) {
  const [catalogState, setCatalogState] = useState(catalog);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>(initialSource);
  const [initialState] = useState(() => {
    const storedThreads =
      typeof window === "undefined" ? [] : loadThreads(window.localStorage);
    const threads = seedThreads(storedThreads, catalog);

    return {
      threads,
      activeThreadId: threads[0]?.id ?? null,
    };
  });
  const [threads, setThreads] = useState(initialState.threads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialState.activeThreadId,
  );

  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  useEffect(() => {
    let cancelled = false;

    fetchCatalogStateFromUrl("/api/agent-presets", {
      cache: "no-store",
    })
      .then(({ catalog: nextCatalog, source }) => {
        if (cancelled) {
          return;
        }

        setCatalogState(nextCatalog);
        setCatalogSource(source);
        setThreads((previousThreads) => {
          const nextThreads = seedThreads(previousThreads, nextCatalog);

          setActiveThreadId((previousActiveThreadId) => {
            if (
              previousActiveThreadId &&
              nextThreads.some((thread) => thread.id === previousActiveThreadId)
            ) {
              return previousActiveThreadId;
            }

            return nextThreads[0]?.id ?? null;
          });

          return nextThreads;
        });
      })
      .catch(() => {
        // Keep the static shell available when the backend is offline.
        setCatalogSource("fallback");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  );
  const fallbackPresetId = resolveDefaultPresetId(catalogState);
  const currentPreset =
    (activeThread
      ? findPresetById(catalogState.presets, activeThread.presetId)
      : undefined) ??
    (fallbackPresetId
      ? findPresetById(catalogState.presets, fallbackPresetId)
      : undefined);

  if (!activeThread || !currentPreset) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Assistant</h1>
        <p>No configured agent presets are available. Add at least one provider key.</p>
      </main>
    );
  }

  const { provider, permissionMode } = parsePresetId(currentPreset.id);

  function appendThread(presetId: AgentPresetDefinition["id"]) {
    const nextThread = createLocalThread(presetId);

    setThreads((previous) => [nextThread, ...previous]);
    setActiveThreadId(nextThread.id);
  }

  function selectThread(threadId: string) {
    if (!threads.some((thread) => thread.id === threadId)) {
      return;
    }

    setActiveThreadId(threadId);
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
          appendThread(currentPreset.id);
        }}
      />
      <section style={{ padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>Assistant</h1>
        <SettingsPanel
          provider={provider}
          permissionMode={permissionMode}
          presets={catalogState.presets}
          onProviderChange={(nextProvider) => {
            const nextPreset =
              findPreset(catalogState.presets, nextProvider, permissionMode) ??
              catalogState.presets.find(
                (preset) => preset.provider === nextProvider,
              );

            if (!nextPreset || activeThread.presetId === nextPreset.id) {
              return;
            }

            appendThread(nextPreset.id);
          }}
          onPermissionModeChange={(nextPermissionMode) => {
            const nextPreset = findPreset(
              catalogState.presets,
              provider,
              nextPermissionMode,
            );

            if (!nextPreset || activeThread.presetId === nextPreset.id) {
              return;
            }

            appendThread(nextPreset.id);
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
          {catalogSource === "live" ? (
            <CopilotChat agentId={activeThread.presetId} threadId={activeThread.id} />
          ) : (
            <div style={{ padding: 24 }}>
              Backend is offline. Start the local agent service to enable chat.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
