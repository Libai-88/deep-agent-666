"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  CopilotChatConfigurationProvider,
  CopilotChat,
  useCopilotKit,
  useRenderTool,
  useInterrupt,
  useConfigureSuggestions,
  useAgentContext,
  useAgent,
} from "@copilotkit/react-core/v2";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Message } from "@ag-ui/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  MessagesSquare,
  Settings,
  SquarePen,
  Bot,
} from "lucide-react";
import { ThreadList } from "@/components/ThreadList";
import { SubAgentActivityCard } from "@/components/SubAgentActivityCard";
import {
  createLocalThread,
  deriveThreadTitle,
  loadThreads,
  renameThread,
  resolveNextThreadIdAfterDelete,
  saveThreads,
  sanitizeThreads,
  sortThreadsByUpdatedAt,
  type LocalThread,
} from "@/lib/thread-registry";
import {
  createEmptyWorkbenchState,
  appendWorkbenchArtifacts,
  loadWorkbenchState,
  postRuntimeControlCommand,
  removeWorkbenchState,
  replaceWorkbenchArtifacts,
  replaceWorkbenchTodos,
  saveWorkbenchState,
  type ThreadWorkbenchState,
} from "@/lib/workbench-state";
import {
  applyWorkbenchEvents,
  applyCoordinatorToolCallFallback,
  buildEditablePlanDraft,
  extractFinalSummary,
  inferTaskKindFromMessage,
  normalizeDelegationArtifacts,
  normalizeDelegationsToTodos,
  normalizeToolCallToArtifacts,
  normalizeToolCallToTodos,
} from "@/lib/tool-result-normalizer";
import { normalizeSnapshotEvents } from "@/lib/runtime-events";
import { resolveThreadAgentId } from "@/lib/thread-agent";
import {
  ALL_AGENT_PRESETS,
  type AgentPresetDefinition,
  type AgentPresetId,
  findPresetById,
  resolveDefaultPresetId,
} from "@/lib/agent-presets";
import { ToolCallCard } from "@/components/ToolCallCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileBrowser } from "@/components/FileBrowser";
import { FileViewDialog } from "@/components/FileViewDialog";
import { TaskTimelinePanel } from "@/components/TaskTimelinePanel";
import { ArtifactResultsPanel } from "@/components/ArtifactResultsPanel";
import { HomePageShell } from "@/components/HomePageShell";
import { PlanEditorPanel } from "@/components/PlanEditorPanel";
import {
  ProviderRegistryEditor,
  type ProviderProbeState,
} from "@/components/ProviderRegistryEditor";
import { RunControlBar } from "@/components/RunControlBar";
import {
  RuntimeDiagnosticsDialog,
  RuntimeStatusBadge,
} from "@/components/RuntimeDiagnosticsDialog";
import { WorkbenchStatusNotice } from "@/components/WorkbenchStatusNotice";
import {
  resolveFirstRunState,
  type FirstRunState,
} from "@/lib/first-run-state";
import {
  resolveRecoverableActions,
  resolveRecoverableErrorCode,
  type RecoverableAction,
  type RecoverableErrorCode,
} from "@/lib/runtime-errors";
import {
  fetchCatalogStateFromUrl,
  type CatalogState,
} from "@/lib/preset-catalog";
import { requestRuntimeBootstrapRefresh } from "@/lib/runtime-bootstrap";
import {
  STARTER_TEMPLATES,
  createStarterThread,
  type StarterTemplate,
  seedWorkbenchForStarterTemplate,
} from "@/lib/starter-templates";
import {
  extractLatestAssistantText,
  extractLatestUserPrompt,
  resolvePendingRunPrompt,
} from "@/lib/retry-run";
import {
  hasRestorableThreadContext,
  restoredMessagesIncludePrompt,
  shouldFlagThreadHistoryGap,
} from "@/lib/thread-history-gap";
import {
  buildRuntimeConfigRequestBody,
  normalizeRuntimeSettings,
  type RuntimeModelProfile,
  type RuntimeProviderProfile,
  type RuntimeSettings,
} from "@/lib/runtime-settings";
import {
  resolveRunControlState,
  type RunControlAction,
  type RunControlSnapshot,
} from "@/lib/run-control-state";
import {
  countConfiguredProviders,
  normalizeRuntimeDiagnostics,
  type RuntimeDiagnostics,
} from "@/lib/runtime-diagnostics";

export default function HomePage() {
  return (
    <React.Suspense fallback={null}>
      <HomePageContent />
    </React.Suspense>
  );
}

type RuntimeAvailability = "ready" | "empty" | "unreachable";

async function fetchRuntimeAvailability(): Promise<RuntimeAvailability> {
  try {
    const response = await fetch("/api/copilotkit/info", {
      cache: "no-store",
    });
    if (!response.ok) {
      return "unreachable";
    }

    const payload = (await response.json()) as {
      agents?: unknown;
    };
    const agents =
      payload.agents && typeof payload.agents === "object"
        ? Object.keys(payload.agents as Record<string, unknown>)
        : [];

    return agents.length > 0 ? "ready" : "empty";
  } catch {
    return "unreachable";
  }
}

async function fetchRuntimeSettings(): Promise<RuntimeSettings> {
  const response = await fetch("/api/runtime-config", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load runtime config: ${response.status}`);
  }

  return normalizeRuntimeSettings((await response.json()) as unknown);
}

async function fetchRuntimeDiagnostics(): Promise<RuntimeDiagnostics> {
  const response = await fetch("/api/runtime-diagnostics", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load runtime diagnostics: ${response.status}`);
  }

  return normalizeRuntimeDiagnostics((await response.json()) as unknown);
}

function HomePageContent() {
  const [sidebar, setSidebar] = useQueryParamState("sidebar");
  const [threadId, setThreadId] = useQueryParamState("threadId");
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    catalog: { defaultPresetId: null, presets: [] },
    source: "fallback",
  });
  const [catalogChecking, setCatalogChecking] = useState(true);
  const [runtimeAvailability, setRuntimeAvailability] =
    useState<RuntimeAvailability>("empty");
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(() =>
    normalizeRuntimeSettings(null),
  );
  const [runtimeDiagnostics, setRuntimeDiagnostics] =
    useState<RuntimeDiagnostics>(() => normalizeRuntimeDiagnostics(null));
  const [runtimeDiagnosticsLoading, setRuntimeDiagnosticsLoading] =
    useState(true);
  const [recoverableError, setRecoverableError] =
    useState<RecoverableErrorCode | null>(null);
  const [pendingThreadRun, setPendingThreadRun] =
    useState<PendingThreadRun | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const handleOpenWorkspaceFile = useCallback(async (path: string) => {
    setPreviewFile(path);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/workspace/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviewContent(data.content ?? "");
    } catch {
      setPreviewContent("// Failed to load file");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const [threads, setThreads] = useState<LocalThread[]>(() => loadThreads());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planEditorDraft, setPlanEditorDraft] = useState("");
  const [workbenchState, setWorkbenchState] = useState<ThreadWorkbenchState>(
    () => createEmptyWorkbenchState(),
  );
  const [loadedWorkbenchThreadId, setLoadedWorkbenchThreadId] = useState<string | null>(null);
  const [hasLiveThreadActivity, setHasLiveThreadActivity] = useState(false);
  const [runtimeControl, setRuntimeControl] =
    useState<RunControlSnapshot | null>(null);

  // Persist threads to localStorage on change
  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  const reloadRuntimeSettings = useCallback(async () => {
    try {
      const nextSettings = await fetchRuntimeSettings();
      setRuntimeSettings(nextSettings);
    } catch {
      // Keep the last known runtime settings when the backend is unavailable.
    }
  }, []);

  const reloadRuntimeDiagnostics = useCallback(async () => {
    setRuntimeDiagnosticsLoading(true);
    try {
      const nextDiagnostics = await fetchRuntimeDiagnostics();
      setRuntimeDiagnostics(nextDiagnostics);
    } catch {
      // Preserve the last diagnostics snapshot when refresh fails.
    } finally {
      setRuntimeDiagnosticsLoading(false);
    }
  }, []);

  const reloadCatalogState = useCallback(async () => {
    setCatalogChecking(true);
    try {
      const nextState = await fetchCatalogStateFromUrl("/api/preset-state", {
        cache: "no-store",
      });
      setCatalogState(nextState);
      setThreads((previous) =>
        sanitizeThreads(previous, nextState.catalog.presets),
      );
      if (nextState.catalog.presets.length === 0 || threads.length === 0) {
        setRecoverableError(null);
        return;
      }

      const runtimeAvailability = await fetchRuntimeAvailability();
      setRuntimeAvailability(runtimeAvailability);
      if (runtimeAvailability === "ready") {
        setRecoverableError(null);
        return;
      }

      setRecoverableError(
        runtimeAvailability === "unreachable"
          ? "backend_unreachable"
          : "runtime_request_failed",
      );
    } catch {
      setRuntimeAvailability("unreachable");
      setRecoverableError("backend_unreachable");
    } finally {
      setCatalogChecking(false);
    }
  }, [threads.length]);

  useEffect(() => {
    void reloadCatalogState();
  }, [reloadCatalogState]);

  useEffect(() => {
    void reloadRuntimeSettings();
  }, [reloadRuntimeSettings]);

  useEffect(() => {
    void reloadRuntimeDiagnostics();
  }, [reloadRuntimeDiagnostics]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleRuntimeError = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string; event?: unknown }>).detail;
      if (detail?.source === "copilotkit") {
        setRecoverableError(resolveRecoverableErrorCode(detail.event ?? detail));
      }
    };

    window.addEventListener("deep-agent-666.runtime-error", handleRuntimeError);
    return () => {
      window.removeEventListener(
        "deep-agent-666.runtime-error",
        handleRuntimeError,
      );
    };
  }, []);

  const activeThread = useMemo(() => {
    if (threadId) {
      return threads.find((thread) => thread.id === threadId) ?? null;
    }

    return threads[0] ?? null;
  }, [threadId, threads]);

  const currentPreset = useMemo(() => {
    if (!activeThread) return null;
    return (
      findPresetById(catalogState.catalog.presets, activeThread.presetId) ??
      findPresetById(ALL_AGENT_PRESETS, activeThread.presetId as AgentPresetId) ??
      null
    );
  }, [activeThread, catalogState.catalog.presets]);
  const activeAgentId = useMemo(() => {
    if (!currentPreset) return undefined;
    return resolveThreadAgentId(currentPreset.id, currentPreset.permissionMode);
  }, [currentPreset]);
  useEffect(() => {
    if (!activeThread) {
      setLoadedWorkbenchThreadId(null);
      setWorkbenchState(createEmptyWorkbenchState());
      setHasLiveThreadActivity(false);
      setRuntimeControl(null);
      setPlanEditorDraft("");
      return;
    }
    setLoadedWorkbenchThreadId(null);
    setWorkbenchState(loadWorkbenchState(activeThread.id));
    setLoadedWorkbenchThreadId(activeThread.id);
    setHasLiveThreadActivity(false);
    setRuntimeControl(null);
    setPlanEditorDraft("");
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    if (loadedWorkbenchThreadId !== activeThread.id) return;
    saveWorkbenchState(activeThread.id, workbenchState);
  }, [activeThread, loadedWorkbenchThreadId, workbenchState]);

  const effectiveRecoverableError =
    recoverableError ?? (activeThread && !currentPreset ? "thread_missing_or_invalid" : null);

  const firstRunState = resolveFirstRunState({
    isChecking: catalogChecking,
    catalog: catalogState.catalog,
    catalogSource: catalogState.source,
    threads,
    activeThreadId: threadId ?? activeThread?.id ?? null,
    recoverableError: effectiveRecoverableError,
  });

  const gatePresentation = useMemo(
    () => resolveGatePresentation(firstRunState, effectiveRecoverableError),
    [effectiveRecoverableError, firstRunState],
  );

  const noticePresentation = useMemo(
    () =>
      effectiveRecoverableError
        ? resolveRecoverablePresentation(effectiveRecoverableError)
        : null,
    [effectiveRecoverableError],
  );
  const noticeActions = useMemo(
    () =>
      effectiveRecoverableError
        ? resolveRecoverableActions(effectiveRecoverableError, {
            hasActiveThread: Boolean(activeThread),
            hasRetryableTask: Boolean(workbenchState.lastUserPrompt),
          })
        : [],
    [activeThread, effectiveRecoverableError, workbenchState.lastUserPrompt],
  );

  const runControlState = useMemo(
    () =>
      resolveRunControlState({
        threadId: activeThread?.id ?? null,
        runtimeControl,
        activeProviderId: currentPreset?.provider ?? null,
        activeModelId: currentPreset?.label ?? null,
      }),
    [
      activeThread,
      runtimeControl,
      currentPreset,
    ],
  );

  const effectiveRuntimeDiagnostics = useMemo<RuntimeDiagnostics>(() => {
    if (runtimeDiagnostics.backendReachable) {
      return runtimeDiagnostics;
    }

    return {
      ...runtimeDiagnostics,
      configuredProviderCount: Math.max(
        runtimeDiagnostics.configuredProviderCount,
        countConfiguredProviders(runtimeSettings),
      ),
      workspaceRoot:
        runtimeDiagnostics.workspaceRoot ?? runtimeSettings.workspaceRoot,
      providers: {
        openai:
          runtimeDiagnostics.providers.openai.configured ||
          runtimeDiagnostics.providers.openai.baseUrl
            ? runtimeDiagnostics.providers.openai
            : runtimeSettings.providers.openai,
        anthropic:
          runtimeDiagnostics.providers.anthropic.configured ||
          runtimeDiagnostics.providers.anthropic.baseUrl
            ? runtimeDiagnostics.providers.anthropic
            : runtimeSettings.providers.anthropic,
        google:
          runtimeDiagnostics.providers.google.configured ||
          runtimeDiagnostics.providers.google.baseUrl
            ? runtimeDiagnostics.providers.google
            : runtimeSettings.providers.google,
      },
    };
  }, [runtimeDiagnostics, runtimeSettings]);

  const refreshRuntimeSurfaces = useCallback(
    async ({
      withBootstrap = false,
    }: {
      withBootstrap?: boolean;
    } = {}) => {
      if (withBootstrap) {
        await requestRuntimeBootstrapRefresh();
      }

      await Promise.all([
        reloadCatalogState(),
        reloadRuntimeSettings(),
        reloadRuntimeDiagnostics(),
      ]);
    },
    [reloadCatalogState, reloadRuntimeDiagnostics, reloadRuntimeSettings],
  );

  const handleNewThread = useCallback(() => {
    const defaultId = resolveDefaultPresetId(catalogState.catalog);
    if (!defaultId) {
      setSettingsOpen(true);
      return;
    }
    const thread = createLocalThread(defaultId);
    setThreads((prev) => [thread, ...prev]);
    setThreadId(thread.id);
    setRecoverableError(null);
  }, [catalogState.catalog, setThreadId]);

  const handleSelectThread = useCallback(
    (id: string) => {
      setThreadId(id);
      setRecoverableError(null);
    },
    [setThreadId],
  );

  const handleSwitchPreset = useCallback(
    (presetId: AgentPresetId) => {
      if (!activeThread) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThread.id ? { ...t, presetId } : t,
        ),
      );
    },
    [activeThread],
  );

  const handleRenameThread = useCallback((id: string, title: string) => {
    setThreads((previous) =>
      sortThreadsByUpdatedAt(
        previous.map((thread) =>
          thread.id === id ? renameThread(thread, title) : thread,
        ),
      ),
    );
  }, []);

  const handleDeleteThread = useCallback(
    (id: string) => {
      const targetThread = threads.find((thread) => thread.id === id);
      if (!targetThread) {
        return;
      }

      if (!window.confirm(`Delete thread "${targetThread.title}"?`)) {
        return;
      }

      removeWorkbenchState(id);
      const remainingThreads = threads.filter((thread) => thread.id !== id);
      const nextThreadId = resolveNextThreadIdAfterDelete({
        deletedThreadId: id,
        activeThreadId: activeThread?.id ?? null,
        remainingThreads,
      });

      setThreads(sortThreadsByUpdatedAt(remainingThreads));
      setThreadId(nextThreadId);
      setRecoverableError(null);
    },
    [activeThread?.id, setThreadId, threads],
  );

  const handleSelectStarterTemplate = useCallback(
    (template: StarterTemplate) => {
      const presetId = resolveDefaultPresetId(catalogState.catalog);
      if (!presetId) {
        setSettingsOpen(true);
        return;
      }

      const thread = createStarterThread(presetId, template);
      const seededWorkbench = seedWorkbenchForStarterTemplate(
        template.category,
        template.prompt,
      );

      saveWorkbenchState(thread.id, seededWorkbench);
      setThreads((previous) => [thread, ...previous]);
      setWorkbenchState(seededWorkbench);
      setLoadedWorkbenchThreadId(thread.id);
      setThreadId(thread.id);
      setRecoverableError(null);
      setPendingThreadRun({
        id: crypto.randomUUID(),
        threadId: thread.id,
        agentId: resolveThreadAgentId(
          presetId,
          findPresetById(catalogState.catalog.presets, presetId)?.permissionMode ??
            "balanced",
        ),
        prompt: template.prompt,
      });
    },
    [catalogState.catalog, setThreadId],
  );

  const handleRecoveryAction = useCallback(
    (action: RecoverableAction["action"]) => {
      switch (action) {
        case "retry_connection":
          void refreshRuntimeSurfaces({ withBootstrap: true });
          return;
        case "view_diagnostics":
          setDiagnosticsOpen(true);
          void refreshRuntimeSurfaces();
          return;
        case "open_settings":
        case "configure_provider":
        case "retry_save":
        case "check_base_url":
          setSettingsOpen(true);
          return;
        case "create_recommended_thread":
          handleNewThread();
          return;
        case "retry_last_task":
          if (!activeThread || !activeAgentId) {
            return;
          }
          if (runtimeAvailability === "ready") {
            setRecoverableError(null);
          }
          setPendingThreadRun({
            id: crypto.randomUUID(),
            threadId: activeThread.id,
            agentId: activeAgentId,
            prompt: workbenchState.lastUserPrompt ?? undefined,
          });
          return;
      }
    },
    [
      activeAgentId,
      activeThread,
      handleNewThread,
      refreshRuntimeSurfaces,
      runtimeAvailability,
      workbenchState.lastUserPrompt,
    ],
  );

  const ACTION_LABELS: Record<RunControlAction, string> = {
    approve_plan: "Approve Plan",
    edit_plan: "Edit Plan",
    retry_last: "Retry Last",
    request_stop: "Stop",
  };

  const handleRunControlAction = useCallback(
    async (action: RunControlAction) => {
      if (action === "retry_last") {
        handleRecoveryAction("retry_last_task");
        return;
      }

      if (!activeThread) {
        return;
      }

      if (action === "edit_plan") {
        setPlanEditorDraft(
          buildEditablePlanDraft(workbenchState.todos, workbenchState.events),
        );
        return;
      }

      try {
        const result = await postRuntimeControlCommand({
          thread_id: activeThread.id,
          action,
        });
        if (result) {
          setRuntimeControl(result);
        }
      } catch {
        setRecoverableError("backend_unreachable");
      }
    },
    [activeThread, handleRecoveryAction, workbenchState.events, workbenchState.todos],
  );

  const handlePlanEditorSubmit = useCallback(
    async (action: RunControlAction) => {
      if (!activeThread) return;
      try {
        const result = await postRuntimeControlCommand({
          thread_id: activeThread.id,
          action,
          plan_patch: action === "edit_plan" ? planEditorDraft : undefined,
        });
        if (result) {
          setRuntimeControl(result);
          setRecoverableError(null);
        } else {
          setRecoverableError("runtime_request_failed");
        }
      } catch {
        setRecoverableError("backend_unreachable");
      }
    },
    [activeThread, planEditorDraft],
  );

  const settingsPreset =
    currentPreset ??
    findPresetById(
      catalogState.catalog.presets,
      resolveDefaultPresetId(catalogState.catalog) ?? "openai-balanced",
    ) ??
    findPresetById(
      ALL_AGENT_PRESETS,
      resolveDefaultPresetId(catalogState.catalog) ?? "openai-balanced",
    ) ??
    ALL_AGENT_PRESETS[1];

  if (
    firstRunState !== "ready-active-thread" ||
    !activeThread ||
    !currentPreset ||
    !activeAgentId
  ) {
    return (
      <div className="flex h-screen flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Deep Agent 666</h1>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceRootLabel workspaceRoot={runtimeSettings.workspaceRoot} />
            <RuntimeStatusBadge
              status={effectiveRuntimeDiagnostics.status}
              loading={runtimeDiagnosticsLoading}
              onClick={() => setDiagnosticsOpen(true)}
            />
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="mr-1 h-4 w-4" />
              Settings
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <HomePageShell
            state={firstRunState}
            starterTemplates={STARTER_TEMPLATES}
            gateTitle={gatePresentation.title}
            gateDescription={gatePresentation.description}
            gateActions={gatePresentation.actions}
            onGateAction={handleRecoveryAction}
            onStarterSelect={handleSelectStarterTemplate}
          >
            <div />
          </HomePageShell>
        </div>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          currentPreset={settingsPreset}
          onSwitchPreset={handleSwitchPreset}
          onSaved={async (nextSettings) => {
            setRecoverableError(null);
            setRuntimeSettings(nextSettings);
            await Promise.all([
              reloadCatalogState(),
              reloadRuntimeDiagnostics(),
            ]);
          }}
          onSaveFailed={(code) => setRecoverableError(code)}
        />
        <RuntimeDiagnosticsDialog
          open={diagnosticsOpen}
          onOpenChange={setDiagnosticsOpen}
          diagnostics={effectiveRuntimeDiagnostics}
          refreshing={runtimeDiagnosticsLoading}
          onRefresh={() => void refreshRuntimeSurfaces({ withBootstrap: true })}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Deep Agent 666</h1>
          {!sidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebar("1")}
              className="ml-2 gap-2 text-xs text-muted-foreground"
            >
              <MessagesSquare className="h-4 w-4" />
              Threads
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <WorkspaceRootLabel workspaceRoot={runtimeSettings.workspaceRoot} />
          <RuntimeStatusBadge
            status={effectiveRuntimeDiagnostics.status}
            loading={runtimeDiagnosticsLoading}
            onClick={() => setDiagnosticsOpen(true)}
          />
          <ThemeToggle />
          <span className="text-xs text-muted-foreground">
            {currentPreset.label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="mr-1 h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleNewThread}
          >
            <SquarePen className="mr-1 h-4 w-4" />
            New Thread
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" data-testid="workbench-shell">
          <ResizablePanel
            id="left-rail"
            order={1}
            defaultSize={22}
            minSize={16}
            maxSize={35}
            className={`min-w-[280px] transition-all duration-300 ${sidebar ? "" : "!w-0 !min-w-0 !max-w-0 overflow-hidden"}`}
            collapsible
            collapsedSize={0}
          >
            <div className={`flex h-full flex-col ${sidebar ? "" : "hidden"}`}>
              <ThreadList
                threads={threads}
                activeThreadId={activeThread.id}
                onSelect={handleSelectThread}
                onRename={handleRenameThread}
                onDelete={handleDeleteThread}
                onClose={() => setSidebar(null)}
              />
              <TaskTimelinePanel
                taskKind={workbenchState.taskKind}
                events={workbenchState.events}
                todos={workbenchState.todos}
              />
            </div>
          </ResizablePanel>
          {sidebar && <ResizableHandle />}

          <ResizablePanel id="main-panel" order={2}>
            <div className="flex h-full flex-col">
              <section data-testid="workbench-status-header">
                {noticePresentation && effectiveRecoverableError ? (
                  <WorkbenchStatusNotice
                    title={noticePresentation.title}
                    description={noticePresentation.description}
                    actions={noticeActions}
                    onAction={handleRecoveryAction}
                  />
                ) : null}
              </section>
              <section
                data-testid="workbench-main-panel"
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="border-b border-border px-4 py-2">
                  <RunControlBar
                    state={runControlState}
                    onAction={(action) => void handleRunControlAction(action)}
                  />
                </div>
                {/* Model / Permission bar */}
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <span className="text-xs text-muted-foreground">Model:</span>
                  <PresetSelector
                    presets={catalogState.catalog.presets.filter(
                      (p) => p.provider === currentPreset.provider,
                    )}
                    value={activeThread.presetId as AgentPresetId}
                    onChange={handleSwitchPreset}
                  />
                  <span className="ml-4 text-xs text-muted-foreground">
                    Permission:
                  </span>
                  <PresetSelector
                    presets={catalogState.catalog.presets.filter(
                      (p) => p.permissionMode === currentPreset.permissionMode,
                    )}
                    value={activeThread.presetId as AgentPresetId}
                    onChange={handleSwitchPreset}
                  />
                </div>

                {/* Chat area */}
                <div className="flex-1 min-h-0 flex flex-col">
                  {runtimeAvailability === "ready" ? (
                    <CopilotChatConfigurationProvider
                      agentId={activeAgentId}
                      threadId={activeThread.id}
                    >
                      <WorkbenchRuntimeHooks
                        activeAgentId={activeAgentId}
                        setHasLiveThreadActivity={setHasLiveThreadActivity}
                        setWorkbenchState={setWorkbenchState}
                      />
                      <ThreadHistoryGapMonitor
                        activeAgentId={activeAgentId}
                        hasLiveThreadActivity={hasLiveThreadActivity}
                        runtimeAvailability={runtimeAvailability}
                        workbenchState={workbenchState}
                        pendingThreadRun={pendingThreadRun}
                        recoverableError={recoverableError}
                        setRecoverableError={setRecoverableError}
                      />
                      {pendingThreadRun && pendingThreadRun.threadId === activeThread.id ? (
                        <PendingThreadRunController
                          key={pendingThreadRun.id}
                          run={pendingThreadRun}
                          onComplete={() => setPendingThreadRun(null)}
                          onError={(error) =>
                            setRecoverableError(resolveRecoverableErrorCode(error))
                          }
                        />
                      ) : null}
                      <ActiveThreadChat
                        activeAgentId={activeAgentId}
                        activeThread={activeThread}
                        setRuntimeControl={setRuntimeControl}
                        currentPreset={currentPreset}
                        setHasLiveThreadActivity={setHasLiveThreadActivity}
                        threadId={threadId}
                        workspaceRoot={runtimeSettings.workspaceRoot}
                        pendingThreadRun={pendingThreadRun}
                        setThreads={setThreads}
                        setWorkbenchState={setWorkbenchState}
                        planEditorDraft={planEditorDraft}
                        setPlanEditorDraft={setPlanEditorDraft}
                        onPlanEditorSubmit={handlePlanEditorSubmit}
                      />
                    </CopilotChatConfigurationProvider>
                  ) : (
                    <ActiveThreadRuntimeFallback runtimeAvailability={runtimeAvailability} />
                  )}
                </div>
              </section>
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel
            id="context-panel"
            order={3}
            defaultSize={25}
            minSize={18}
            className="min-w-[280px]"
          >
            <ArtifactResultsPanel
              artifacts={workbenchState.artifacts}
              finalSummary={workbenchState.finalSummary}
              onOpenFile={handleOpenWorkspaceFile}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentPreset={settingsPreset}
        onSwitchPreset={handleSwitchPreset}
        onSaved={async (nextSettings) => {
          setRecoverableError(null);
          setRuntimeSettings(nextSettings);
          await Promise.all([
            reloadCatalogState(),
            reloadRuntimeDiagnostics(),
          ]);
        }}
        onSaveFailed={(code) => setRecoverableError(code)}
      />
      <RuntimeDiagnosticsDialog
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        diagnostics={effectiveRuntimeDiagnostics}
        refreshing={runtimeDiagnosticsLoading}
        onRefresh={() => void refreshRuntimeSurfaces({ withBootstrap: true })}
      />
      {previewOpen && previewFile && (
        <FileViewDialog
          file={{ path: previewFile, content: previewLoading ? "// Loading..." : previewContent }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function useQueryParamState(
  key: string,
): [string | null, (value: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(key);

  const setValue = useCallback(
    (nextValue: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextValue === null || nextValue === "") {
        params.delete(key);
      } else {
        params.set(key, nextValue);
      }

      const nextSearch = params.toString();
      const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return [value, setValue];
}

function ActiveThreadRuntimeFallback({
  runtimeAvailability,
}: {
  runtimeAvailability: RuntimeAvailability;
}) {
  const message =
    runtimeAvailability === "unreachable"
      ? "The local runtime is offline. Recover the backend connection to continue this thread."
      : "The local runtime is not ready yet. Retry the connection or reopen settings to continue.";

  return (
    <div
      data-testid="active-thread-runtime-fallback"
      className="flex flex-1 items-center justify-center px-6"
    >
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-foreground">
          Runtime unavailable
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ── Shared helpers ──

type PendingThreadRun = {
  id: string;
  threadId: string;
  agentId: string;
  prompt?: string;
};

function PendingThreadRunController({
  run,
  onComplete,
  onError,
}: {
  run: PendingThreadRun;
  onComplete: () => void;
  onError: (error: unknown) => void;
}) {
  const launchedRef = useRef(false);
  const { agent } = useAgent({
    agentId: run.agentId,
  });
  const { copilotkit } = useCopilotKit();

  useEffect(() => {
    if (launchedRef.current || !agent) {
      return;
    }

    launchedRef.current = true;

    const promptToInject = resolvePendingRunPrompt({
      requestedPrompt: run.prompt,
      latestUserPrompt: extractLatestUserPrompt(agent.messages ?? []),
    });

    if (promptToInject) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: promptToInject,
      };
      agent.addMessage(message);
    }

    void copilotkit
      .runAgent({ agent })
      .catch((error: unknown) => {
        onError(error);
      })
      .finally(() => {
        onComplete();
      });
  }, [agent, copilotkit, onComplete, onError, run]);

  return null;
}

function WorkbenchRuntimeHooks({
  activeAgentId,
  setHasLiveThreadActivity,
  setWorkbenchState,
}: {
  activeAgentId: string;
  setHasLiveThreadActivity: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkbenchState: React.Dispatch<React.SetStateAction<ThreadWorkbenchState>>;
}) {
  useRenderTool({
    agentId: activeAgentId,
    name: "planner_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => {
      queueMicrotask(() => {
        setHasLiveThreadActivity(true);
        setWorkbenchState((previous) =>
          applyCoordinatorToolCallFallback(previous, {
            name: "planner_tool",
            status,
            args:
              parameters && typeof parameters === "object"
                ? (parameters as Record<string, unknown>)
                : null,
            result,
          }),
        );
      });

      return (
        <SubAgentActivityCard
          subAgent="planner"
          task={typeof parameters?.task === "string" ? parameters.task : undefined}
          status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
          result={typeof result === "string" ? result : undefined}
        />
      );
    },
  });

  useRenderTool({
    agentId: activeAgentId,
    name: "executor_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => {
      queueMicrotask(() => {
        setHasLiveThreadActivity(true);
        setWorkbenchState((previous) =>
          applyCoordinatorToolCallFallback(previous, {
            name: "executor_tool",
            status,
            args:
              parameters && typeof parameters === "object"
                ? (parameters as Record<string, unknown>)
                : null,
            result,
          }),
        );
      });

      return (
        <SubAgentActivityCard
          subAgent="executor"
          task={typeof parameters?.task === "string" ? parameters.task : undefined}
          status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
          result={typeof result === "string" ? result : undefined}
        />
      );
    },
  });

  useRenderTool({
    agentId: activeAgentId,
    name: "reviewer_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => {
      queueMicrotask(() => {
        setHasLiveThreadActivity(true);
        setWorkbenchState((previous) =>
          applyCoordinatorToolCallFallback(previous, {
            name: "reviewer_tool",
            status,
            args:
              parameters && typeof parameters === "object"
                ? (parameters as Record<string, unknown>)
                : null,
            result,
          }),
        );
      });

      return (
        <SubAgentActivityCard
          subAgent="reviewer"
          task={typeof parameters?.task === "string" ? parameters.task : undefined}
          status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
          result={typeof result === "string" ? result : undefined}
        />
      );
    },
  });

  useRenderTool({
    agentId: activeAgentId,
    name: "*",
    render: ({ name, status, args, result }) => {
      const normalizedTodos = normalizeToolCallToTodos({
        name,
        status,
        args,
        result,
      });
      const normalizedArtifacts = normalizeToolCallToArtifacts({
        name,
        status,
        args,
        result,
      });

      if (normalizedTodos.length > 0 || normalizedArtifacts.length > 0) {
        queueMicrotask(() => {
          setHasLiveThreadActivity(true);
          setWorkbenchState((previous) => {
            const withTodos =
              normalizedTodos.length > 0
                ? replaceWorkbenchTodos(previous, normalizedTodos)
                : previous;
            const withArtifacts = normalizedArtifacts.length > 0
              ? appendWorkbenchArtifacts(withTodos, normalizedArtifacts)
              : withTodos;
            const summary = extractFinalSummary(result);
            return summary
              ? {
                  ...withArtifacts,
                  finalSummary: summary,
                  updatedAt: Date.now(),
                }
              : withArtifacts;
          });
        });
      }

      return <ToolCallCard name={name} status={status} args={args} result={result} />;
    },
  });

  useInterrupt({
    agentId: activeAgentId,
    render: ({ event, resolve }) => {
      const question =
        (event.value as { question?: string })?.question ??
        event.value?.toString() ??
        "Approve this action?";
      return (
        <div className="mx-4 my-2 rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-card-foreground">
            {question}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resolve({ approved: true })}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => resolve({ approved: false })}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      );
    },
  });

  useConfigureSuggestions({
    consumerAgentId: activeAgentId,
    suggestions: [
      {
        title: "📋 Research",
        message: "Research the latest trends in AI agents and summarize them",
      },
      {
        title: "📝 Write",
        message: "Write a summary of my workspace files and their purposes",
      },
      {
        title: "🔍 Find",
        message: "Search for files containing TODO in my workspace",
      },
      {
        title: "📊 Analyze",
        message: "Analyze the project structure and suggest improvements",
      },
    ],
    available: "always",
  });

  return null;
}

function ThreadHistoryGapMonitor({
  activeAgentId,
  hasLiveThreadActivity,
  runtimeAvailability,
  workbenchState,
  pendingThreadRun,
  recoverableError,
  setRecoverableError,
}: {
  activeAgentId: string;
  hasLiveThreadActivity: boolean;
  runtimeAvailability: RuntimeAvailability;
  workbenchState: ThreadWorkbenchState;
  pendingThreadRun: PendingThreadRun | null;
  recoverableError: RecoverableErrorCode | null;
  setRecoverableError: React.Dispatch<
    React.SetStateAction<RecoverableErrorCode | null>
  >;
}) {
  const { agent } = useAgent({
    agentId: activeAgentId,
  });

  const restorableContext = useMemo(
    () => hasRestorableThreadContext(workbenchState),
    [workbenchState],
  );

  useEffect(() => {
    if (recoverableError && recoverableError !== "thread_history_unavailable") {
      return undefined;
    }

    if (
      hasLiveThreadActivity ||
      pendingThreadRun ||
      !restorableContext ||
      runtimeAvailability !== "ready"
    ) {
      setRecoverableError((previous) =>
        previous === "thread_history_unavailable" ? null : previous,
      );
      return undefined;
    }

    const messageCount = Array.isArray(agent?.messages) ? agent.messages.length : 0;
    const restoredPromptPresent = restoredMessagesIncludePrompt(
      Array.isArray(agent?.messages) ? agent.messages : [],
      workbenchState.lastUserPrompt,
    );
    if (!shouldFlagThreadHistoryGap({
      runtimeAvailability,
      hasRestorableContext: restorableContext,
      messageCount,
      lastUserPrompt: workbenchState.lastUserPrompt,
      restoredPromptPresent,
    })) {
      setRecoverableError((previous) =>
        previous === "thread_history_unavailable" ? null : previous,
      );
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextMessageCount = Array.isArray(agent?.messages)
        ? agent.messages.length
        : 0;
      const nextRestoredPromptPresent = restoredMessagesIncludePrompt(
        Array.isArray(agent?.messages) ? agent.messages : [],
        workbenchState.lastUserPrompt,
      );
      if (
        shouldFlagThreadHistoryGap({
          runtimeAvailability,
          hasRestorableContext: restorableContext,
          messageCount: nextMessageCount,
          lastUserPrompt: workbenchState.lastUserPrompt,
          restoredPromptPresent: nextRestoredPromptPresent,
        })
      ) {
        setRecoverableError((previous) =>
          previous && previous !== "thread_history_unavailable"
            ? previous
            : "thread_history_unavailable",
        );
      }
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    agent,
    agent?.messages,
    pendingThreadRun,
    recoverableError,
    restorableContext,
    runtimeAvailability,
    hasLiveThreadActivity,
    setRecoverableError,
    workbenchState.lastUserPrompt,
  ]);

  return null;
}

function ActiveThreadChat({
  activeAgentId,
  activeThread,
  setRuntimeControl,
  currentPreset,
  setHasLiveThreadActivity,
  threadId,
  workspaceRoot,
  pendingThreadRun,
  setThreads,
  setWorkbenchState,
  planEditorDraft,
  setPlanEditorDraft,
  onPlanEditorSubmit,
}: {
  activeAgentId: string;
  activeThread: LocalThread;
  setRuntimeControl: React.Dispatch<
    React.SetStateAction<RunControlSnapshot | null>
  >;
  currentPreset: AgentPresetDefinition;
  setHasLiveThreadActivity: React.Dispatch<React.SetStateAction<boolean>>;
  threadId: string | null;
  workspaceRoot: string | null;
  pendingThreadRun: PendingThreadRun | null;
  setThreads: React.Dispatch<React.SetStateAction<LocalThread[]>>;
  setWorkbenchState: React.Dispatch<React.SetStateAction<ThreadWorkbenchState>>;
  planEditorDraft: string;
  setPlanEditorDraft: React.Dispatch<React.SetStateAction<string>>;
  onPlanEditorSubmit: (action: RunControlAction) => void;
}) {
  const { agent } = useAgent({
    agentId: activeAgentId,
  });

  const workspaceContext = useMemo(
    () => ({
      workspaceRoot: workspaceRoot ?? "unknown",
      projectName: "deep-agent-666",
      platform: "windows",
      shell: "powershell",
      currentThreadId: threadId ?? null,
      currentPresetId: currentPreset.id,
    }),
    [currentPreset.id, threadId, workspaceRoot],
  );

  useAgentContext({
    description: "The user's local workspace environment — root path, platform, current thread and model preset",
    value: workspaceContext,
  });

  const rawRuntimeControl = (() => {
    if (!agent?.state || typeof agent.state !== "object") return null;
    const state = agent.state as Record<string, unknown>;
    return (state.runtime_control ?? null) as RunControlSnapshot | null;
  })();

  useEffect(() => {
    setRuntimeControl(rawRuntimeControl ?? null);
  }, [rawRuntimeControl, setRuntimeControl]);

  const coordinatorWorkbenchSnapshot = (() => {
    if (!agent?.state || typeof agent.state !== "object") {
      return null;
    }

    const state = agent.state as {
      delegations?: Array<{
        id: string;
        sub_agent: "planner" | "executor" | "reviewer";
        task: string;
        status: "running" | "completed" | "failed";
        result: string;
      }>;
      workbench_events?: unknown;
      task_kind?: "engineering" | "research" | "general";
      final_summary?: string;
    };

    const delegations = Array.isArray(state.delegations) ? state.delegations : [];
    const events = normalizeSnapshotEvents(state.workbench_events);
    const finalSummary =
      typeof state.final_summary === "string" && state.final_summary.trim()
        ? state.final_summary
        : null;

    return {
      delegations,
      events,
      taskKind: state.task_kind,
      finalSummary,
    };
  })();

  const coordinatorWorkbenchSignature = coordinatorWorkbenchSnapshot
    ? JSON.stringify(coordinatorWorkbenchSnapshot)
    : null;
  const latestCoordinatorAssistantText =
    agent && Array.isArray(agent.messages) && activeAgentId.startsWith("coordinator-")
      ? extractLatestAssistantText(agent.messages)
      : null;

  useEffect(() => {
    if (!agent || !Array.isArray(agent.messages)) return;
    if (agent.messages.length > 0) {
      setHasLiveThreadActivity(true);
    }

    const latestUserPrompt = extractLatestUserPrompt(agent.messages);
    if (!latestUserPrompt) return;

    const taskKind = inferTaskKindFromMessage(latestUserPrompt);

    setWorkbenchState((previous) => {
      if (
        previous.taskKind === taskKind &&
        previous.lastUserPrompt === latestUserPrompt
      ) {
        return previous;
      }
      return {
        ...previous,
        taskKind,
        lastUserPrompt: latestUserPrompt,
        updatedAt: Date.now(),
      };
    });
  }, [agent, agent?.messages, setHasLiveThreadActivity, setWorkbenchState]);

  useEffect(() => {
    if (!agent || !Array.isArray(agent.messages)) return;

    const latestUserPrompt = extractLatestUserPrompt(agent.messages);
    if (!latestUserPrompt) return;

    const nextTitle = deriveThreadTitle(latestUserPrompt);

    setThreads((previous) => {
      const current = previous.find((thread) => thread.id === activeThread.id);
      if (!current || current.title === nextTitle) {
        return previous;
      }

      return previous.map((thread) =>
        thread.id === activeThread.id
          ? {
              ...thread,
              title: nextTitle,
              updatedAt: Date.now(),
            }
          : thread,
      );
    });
  }, [activeThread.id, agent, agent?.messages, setThreads]);

  useEffect(() => {
    if (!latestCoordinatorAssistantText) return;

    setWorkbenchState((previous) => {
      if (previous.finalSummary === latestCoordinatorAssistantText) {
        return previous;
      }

      return {
        ...previous,
        finalSummary: latestCoordinatorAssistantText,
        updatedAt: Date.now(),
      };
    });
  }, [latestCoordinatorAssistantText, setWorkbenchState]);

  useEffect(() => {
    if (!coordinatorWorkbenchSnapshot) return;

    const {
      delegations,
      events,
      taskKind,
      finalSummary,
    } = coordinatorWorkbenchSnapshot;

    if (delegations.length === 0 && events.length === 0 && !taskKind && !finalSummary) {
      return;
    }

    setWorkbenchState((previous) => {
      if (events.length > 0) {
        const next = applyWorkbenchEvents(previous, events);
        return {
          ...next,
          taskKind: taskKind ?? next.taskKind,
          finalSummary: next.finalSummary ?? finalSummary,
          updatedAt: Date.now(),
        };
      }

      const nextTodos = delegations.length > 0
        ? normalizeDelegationsToTodos(delegations)
        : previous.todos;
      const nextArtifacts = delegations.length > 0
        ? normalizeDelegationArtifacts(delegations)
        : previous.artifacts.filter((artifact) => artifact.source !== "delegation");

      const withTodos = delegations.length > 0
        ? replaceWorkbenchTodos(previous, nextTodos)
        : previous;
      const withArtifacts = replaceWorkbenchArtifacts(
        withTodos,
        nextArtifacts,
        "delegation",
      );

      return {
        ...withArtifacts,
        taskKind: taskKind ?? withArtifacts.taskKind,
        finalSummary: finalSummary ?? withArtifacts.finalSummary,
        updatedAt: Date.now(),
      };
    });
  }, [coordinatorWorkbenchSignature, setWorkbenchState]);

  return (
    <>
      {rawRuntimeControl?.phase === "interrupted" && rawRuntimeControl?.reason === "plan_approval" ? (
        <PlanEditorPanel
          snapshot={rawRuntimeControl}
          draftPlan={planEditorDraft}
          onDraftPlanChange={setPlanEditorDraft}
          onSubmit={onPlanEditorSubmit}
        />
      ) : (
        <CopilotChat
          className="h-full"
          agentId={activeAgentId}
          threadId={activeThread.id}
          labels={{
            welcomeMessageText: "Hi! I'm your local AI agent. I can help you with code, files, and tasks.",
            chatInputPlaceholder: "Ask me to research, write files, or manage tasks...",
            chatDisclaimerText: "AI responses may be inaccurate. Verify important information.",
          }}
        />
      )}
    </>
  );
}

function WorkspaceRootLabel({
  workspaceRoot,
}: {
  workspaceRoot: string | null;
}) {
  if (!workspaceRoot) {
    return null;
  }

  return (
    <span
      data-testid="workspace-root-label"
      title={workspaceRoot}
      className="inline-flex max-w-[300px] truncate rounded-md border border-border bg-card/30 px-2 py-1 text-xs text-muted-foreground"
    >
      Workspace: {workspaceRoot}
    </span>
  );
}

function resolveGatePresentation(
  state: FirstRunState,
  recoverableError: RecoverableErrorCode | null,
): {
  title: string;
  description: string;
  actions: RecoverableAction[];
} {
  if (state === "unconfigured") {
    return {
      title: "Configure your providers",
      description:
        "No launchable agent presets are available yet. Add at least one provider key to unlock the first task flow.",
      actions: resolveRecoverableActions("no_available_presets"),
    };
  }

  if (recoverableError) {
    const presentation = resolveRecoverablePresentation(recoverableError);
    return {
      ...presentation,
      actions: resolveRecoverableActions(recoverableError),
    };
  }

  return {
    title: "Start with a guided task",
    description: "Pick a starter task to launch the first agent run.",
    actions: [],
  };
}

function resolveRecoverablePresentation(
  code: RecoverableErrorCode,
): {
  title: string;
  description: string;
} {
  switch (code) {
    case "backend_unreachable":
      return {
        title: "Backend unavailable",
        description:
          "The agent backend could not be reached. Check the local backend URL or restart the backend service.",
      };
    case "no_available_presets":
      return {
        title: "Configure your providers",
        description:
          "No launchable agent presets are available yet. Add at least one provider key to continue.",
      };
    case "configuration_failed":
      return {
        title: "Configuration failed",
        description:
          "The provider settings could not be saved. Review the API key and base URL, then try again.",
      };
    case "workspace_root_invalid":
      return {
        title: "Workspace folder unavailable",
        description:
          "The selected workspace folder does not exist or is not a directory. Reopen settings and choose a valid local folder.",
      };
    case "thread_missing_or_invalid":
      return {
        title: "Thread unavailable",
        description:
          "The selected thread is missing or no longer matches an available preset. Create a fresh thread to continue.",
      };
    case "thread_history_unavailable":
      return {
        title: "Thread history unavailable",
        description:
          "The local thread still exists, but the runtime could not restore its message history. This usually happens after a backend restart or thread database reset. Retry the last task or start a fresh thread.",
      };
    case "provider_rate_limited":
      return {
        title: "Provider limit reached",
        description:
          "The current provider key hit a quota or rate limit. Retry later or open settings and switch credentials.",
      };
    case "provider_access_denied":
      return {
        title: "Provider access denied",
        description:
          "The upstream provider rejected this model for the current account or region. Reopen settings and switch provider, credentials, or base URL.",
      };
    case "provider_model_unavailable":
      return {
        title: "Provider model mismatch",
        description:
          "The selected provider rejected the configured model. Reopen settings and verify the provider key and base URL match the preset.",
      };
    case "provider_auth_failed":
      return {
        title: "Provider authentication failed",
        description:
          "The upstream provider rejected the current API key. Reopen settings and verify the active credentials.",
      };
    case "runtime_request_failed":
      return {
        title: "Agent run interrupted",
        description:
          "The last agent request did not complete cleanly. Retry the task or reopen settings if the runtime changed.",
      };
  }
}

function PresetSelector({
  presets,
  value,
  onChange,
}: {
  presets: readonly AgentPresetDefinition[];
  value: AgentPresetId;
  onChange: (id: AgentPresetId) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AgentPresetId)}
      className="rounded-md border border-input bg-background px-2 py-0.5 text-xs text-foreground"
    >
      {presets.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}

type ProviderConfig = {
  key: string;
  label: string;
  apiKeyName: string;
  baseUrlName: string;
  defaultBaseUrl: string;
};

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    key: "openai",
    label: "OpenAI",
    apiKeyName: "openai_api_key",
    baseUrlName: "openai_base_url",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    key: "anthropic",
    label: "Anthropic",
    apiKeyName: "anthropic_api_key",
    baseUrlName: "anthropic_base_url",
    defaultBaseUrl: "https://api.anthropic.com",
  },
  {
    key: "google",
    label: "Google",
    apiKeyName: "google_api_key",
    baseUrlName: "google_base_url",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
];

function SettingsDialog({
  open,
  onOpenChange,
  currentPreset,
  onSwitchPreset,
  onSaved,
  onSaveFailed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPreset: AgentPresetDefinition;
  onSwitchPreset: (id: AgentPresetId) => void;
  onSaved: (settings: RuntimeSettings) => void | Promise<void>;
  onSaveFailed: (code: RecoverableErrorCode) => void;
}) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [providerProfiles, setProviderProfiles] = useState<RuntimeProviderProfile[]>([]);
  const [modelProfiles, setModelProfiles] = useState<RuntimeModelProfile[]>([]);
  const [probeState, setProbeState] = useState<ProviderProbeState>({});
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const permissions = ["read-only", "balanced", "full-access"] as const;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadCurrentRuntimeConfig = async () => {
      setLoadingConfig(true);
      setMessage(null);
      try {
        const settings = await fetchRuntimeSettings();
        if (cancelled) {
          return;
        }

        setWorkspaceRoot(settings.workspaceRoot ?? "");
        setBaseUrls({
          openai: settings.providers.openai.baseUrl ?? "",
          anthropic: settings.providers.anthropic.baseUrl ?? "",
          google: settings.providers.google.baseUrl ?? "",
        });
        setProviderProfiles(settings.providerProfiles);
        setModelProfiles(settings.modelProfiles);
        setApiKeys({});
        setProbeState({});
      } catch {
        if (cancelled) {
          return;
        }

        setMessage({
          type: "error",
          text: "Failed to load the current runtime settings.",
        });
      } finally {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      }
    };

    void loadCurrentRuntimeConfig();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body = buildRuntimeConfigRequestBody({
        workspaceRoot,
        apiKeys: {
          openai: apiKeys.openai ?? "",
          anthropic: apiKeys.anthropic ?? "",
          google: apiKeys.google ?? "",
        },
        baseUrls: {
          openai: baseUrls.openai ?? "",
          anthropic: baseUrls.anthropic ?? "",
          google: baseUrls.google ?? "",
        },
        providerProfiles: providerProfiles.map((profile) => ({
          id: profile.id,
          label: profile.label,
          protocol: profile.protocol,
          authScheme: profile.authScheme,
          baseUrl: profile.baseUrl,
          apiKey: apiKeys[profile.id] ?? "",
          enabled: profile.enabled,
          headers: profile.headers,
        })),
        modelProfiles,
      });
      const res = await fetch("/api/runtime-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as unknown;
      if (res.ok) {
        const data = normalizeRuntimeSettings(payload);
        setMessage({
          type: "ok",
          text: "Runtime settings applied.",
        });
        await onSaved(data);
        onOpenChange(false);
        void requestRuntimeBootstrapRefresh();
      } else {
        const errorCode = resolveRecoverableErrorCode(payload);
        setMessage({
          type: "error",
          text:
            errorCode === "workspace_root_invalid"
              ? "Choose an existing local folder before saving."
              : "Failed to save configuration.",
        });
        onSaveFailed(errorCode);
      }
    } catch {
      setMessage({ type: "error", text: "Backend is not running" });
      onSaveFailed("backend_unreachable");
    } finally {
      setSaving(false);
    }
  };

  const handleProbe = async (providerId: string) => {
    const providerProfile = providerProfiles.find((profile) => profile.id === providerId);
    const modelProfile =
      modelProfiles.find(
        (profile) =>
          profile.providerId === providerId && profile.enabled && profile.isDefault,
      ) ??
      modelProfiles.find(
        (profile) => profile.providerId === providerId && profile.enabled,
      );

    if (!providerProfile || !modelProfile) {
      setProbeState((current) => ({
        ...current,
        [providerId]: {
          status: "invalid_config",
          message: "Choose an enabled default model first.",
          checkedAt: new Date().toISOString(),
        },
      }));
      return;
    }

    setProbeState((current) => ({
      ...current,
      [providerId]: {
        status: "pending",
        message: null,
        checkedAt: new Date().toISOString(),
      },
    }));

    try {
      const response = await fetch("/api/provider-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerProfile: {
            id: providerProfile.id,
            label: providerProfile.label,
            protocol: providerProfile.protocol,
            authScheme: providerProfile.authScheme,
            baseUrl: providerProfile.baseUrl,
            apiKey: apiKeys[providerId]?.trim() || undefined,
            enabled: providerProfile.enabled,
            headers: providerProfile.headers,
          },
          modelProfile,
        }),
      });
      const payload = (await response.json()) as {
        status?: ProviderProbeState[string]["status"];
        message?: string;
      };
      setProbeState((current) => ({
        ...current,
        [providerId]: {
          status: payload.status ?? "unreachable",
          message: payload.message ?? null,
          checkedAt: new Date().toISOString(),
        },
      }));
    } catch {
      setProbeState((current) => ({
        ...current,
        [providerId]: {
          status: "unreachable",
          message: "Backend is not running.",
          checkedAt: new Date().toISOString(),
        },
      }));
    }
  };

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={() => onOpenChange(false)}
      >
        <div
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
        <h2 className="text-lg font-semibold text-card-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the workspace root, provider API keys, and base URLs.
        </p>

        <div data-testid="settings-section-environment" className="mt-5 space-y-1.5">
          <label
            htmlFor="workspace-root-input"
            className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Workspace Root
          </label>
          <input
            id="workspace-root-input"
            data-testid="workspace-root-input"
            placeholder="D:\\Projects\\my-app"
            value={workspaceRoot}
            onChange={(e) => setWorkspaceRoot(e.target.value)}
            className="w-full rounded-md border border-[#D0D0D8] bg-white px-3 py-1.5 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#7c6fe0]"
          />
          <p className="text-xs text-muted-foreground">
            Choose the local folder this agent is allowed to inspect and edit.
          </p>
        </div>

        {/* Provider / Permission selector */}
        <div data-testid="settings-section-models-presets" className="mt-4 flex gap-4">
          <fieldset className="flex-1">
            <legend className="mb-1 text-xs font-medium text-foreground">Provider</legend>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_CONFIGS.map((cfg) => {
                const preset = ALL_AGENT_PRESETS.find(
                  (ap) =>
                    ap.provider === cfg.key &&
                    ap.permissionMode === currentPreset.permissionMode,
                );
                return (
                  <button
                    key={cfg.key}
                    onClick={() => preset && onSwitchPreset(preset.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentPreset.provider === cfg.key
                        ? "border-[#7c6fe0] bg-[#7c6fe0]/10 text-[#7c6fe0]"
                        : "border-[#D0D0D8] text-[#555] hover:bg-[#f5f5f5]"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="flex-1">
            <legend className="mb-1 text-xs font-medium text-foreground">Permission</legend>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((perm) => {
                const preset = ALL_AGENT_PRESETS.find(
                  (ap) =>
                    ap.permissionMode === perm &&
                    ap.provider === currentPreset.provider,
                );
                return (
                  <button
                    key={perm}
                    onClick={() => preset && onSwitchPreset(preset.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentPreset.permissionMode === perm
                        ? "border-[#7c6fe0] bg-[#7c6fe0]/10 text-[#7c6fe0]"
                        : "border-[#D0D0D8] text-[#555] hover:bg-[#f5f5f5]"
                    }`}
                  >
                    {perm}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* API Key inputs */}
        <div data-testid="settings-section-providers" className="mt-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Provider Credentials
          </h3>
          {PROVIDER_CONFIGS.map((cfg) => (
            <div key={cfg.key} className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {cfg.label}
              </label>
              <input
                type="password"
                placeholder="API Key (sk-...)"
                value={apiKeys[cfg.key] ?? ""}
                onChange={(e) =>
                  setApiKeys((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                }
                className="w-full rounded-md border border-[#D0D0D8] bg-white px-3 py-1.5 text-sm text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#7c6fe0]"
              />
              <input
                placeholder={`Base URL (${cfg.defaultBaseUrl})`}
                value={baseUrls[cfg.key] ?? ""}
                onChange={(e) =>
                  setBaseUrls((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                }
                className="w-full rounded-md border border-[#D0D0D8] bg-white px-3 py-1.5 text-xs text-[#1a1a1a] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#7c6fe0]"
              />
            </div>
          ))}
        </div>

        <div data-testid="settings-section-diagnostics" className="mt-5">
          <ProviderRegistryEditor
            apiKeys={apiKeys}
            providerProfiles={providerProfiles}
            modelProfiles={modelProfiles}
            probeState={probeState}
            onProbe={handleProbe}
            onProviderChange={setProviderProfiles}
            onModelChange={setModelProfiles}
            onApiKeyChange={setApiKeys}
          />
        </div>

        {message && (
          <p
            className={`mt-3 text-xs ${
              message.type === "ok" ? "text-green-600" : "text-destructive"
            }`}
          >
            {message.text}
          </p>
        )}

        {loadingConfig ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Loading current runtime settings...
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-[#D0D0D8] bg-white px-4 py-1.5 text-sm text-[#555] hover:bg-[#f5f5f5]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingConfig}
            className="rounded-lg bg-[#7c6fe0] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#6a5ed0] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
