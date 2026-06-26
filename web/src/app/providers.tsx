"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { catalog } from "@/a2ui/catalog";
import {
  ALL_AGENT_PRESETS,
  findPresetById,
  resolveDefaultPresetId,
} from "@/lib/agent-presets";
import { fetchCatalogStateFromUrl } from "@/lib/preset-catalog";
import { resolveThreadAgentId } from "@/lib/thread-agent";
import { loadThreads } from "@/lib/thread-registry";

type CopilotBootstrapState = {
  agentId?: string;
  threadId?: string;
};

async function hasRuntimeAgents(): Promise<boolean> {
  try {
    const response = await fetch("/api/copilotkit/info", {
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      agents?: unknown;
    };
    return Boolean(
      payload.agents &&
        typeof payload.agents === "object" &&
        Object.keys(payload.agents as Record<string, unknown>).length > 0,
    );
  } catch {
    return false;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [copilotReady, setCopilotReady] = useState<boolean | null>(null);
  const [bootstrapState, setBootstrapState] = useState<CopilotBootstrapState>({
    agentId: undefined,
    threadId: undefined,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const state = await fetchCatalogStateFromUrl("/api/preset-state", {
          cache: "no-store",
        });
        if (!cancelled) {
          if (state.catalog.presets.length === 0) {
            setBootstrapState({
              agentId: undefined,
              threadId: undefined,
            });
            setCopilotReady(false);
            return;
          }

          const threads = loadThreads();
          const selectedThreadId =
            typeof window === "undefined"
              ? null
              : new URLSearchParams(window.location.search).get("threadId");
          const activeThread = selectedThreadId
            ? threads.find((thread) => thread.id === selectedThreadId) ?? null
            : threads[0] ?? null;
          const defaultPresetId = resolveDefaultPresetId(state.catalog);
          const bootstrapPreset =
            (activeThread
              ? findPresetById(state.catalog.presets, activeThread.presetId) ??
                findPresetById(ALL_AGENT_PRESETS, activeThread.presetId)
              : null) ??
            (defaultPresetId
              ? findPresetById(state.catalog.presets, defaultPresetId) ??
                findPresetById(ALL_AGENT_PRESETS, defaultPresetId)
              : null);

          setBootstrapState({
            agentId: bootstrapPreset
              ? resolveThreadAgentId(
                  bootstrapPreset.id,
                  bootstrapPreset.permissionMode,
                )
              : undefined,
            threadId: activeThread?.id,
          });
          setCopilotReady(await hasRuntimeAgents());
        }
      } catch {
        if (!cancelled) {
          setBootstrapState({
            agentId: undefined,
            threadId: undefined,
          });
          setCopilotReady(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (copilotReady === null) {
    return null;
  }

  if (!copilotReady) {
    return <>{children}</>;
  }

  return (
    <CopilotKit
      agent={bootstrapState.agentId}
      runtimeUrl="/api/copilotkit"
      threadId={bootstrapState.threadId}
      useSingleEndpoint={false}
      credentials="include"
      a2ui={{ catalog }}
      onError={(event) => {
        console.error("[copilotkit]", event);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("deep-agent-666.runtime-error", {
              detail: {
                source: "copilotkit",
                event,
              },
            }),
          );
        }
      }}
    >
      {children}
    </CopilotKit>
  );
}
