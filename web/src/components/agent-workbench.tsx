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
      <main className="wb">
        <section className="wb-main">
          <h1 className="wb-main__title">Assistant</h1>
          <p>No configured agent presets are available. Add at least one provider key.</p>
        </section>
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
    <main className="wb">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThread.id}
        onSelectThread={selectThread}
        onCreateThread={() => {
          appendThread(currentPreset.id);
        }}
      />
      <section className="wb-main">
        <div className="wb-main__header">
          <h1 className="wb-main__title">Assistant</h1>
          <span className="wb-main__status">
            {catalogSource === "live" ? "Connected" : "Offline"}
          </span>
        </div>
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
        <div className="wb-chat">
          {catalogSource === "live" ? (
            <CopilotChat agentId={activeThread.presetId} threadId={activeThread.id} />
          ) : (
            <div className="wb-offline">
              <span className="wb-offline__icon">&#9889;</span>
              <span>Backend is offline</span>
              <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>
                Start the local agent service to enable chat
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
