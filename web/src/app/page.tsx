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
  saveThreads,
  sanitizeThreads,
  type LocalThread,
} from "@/lib/thread-registry";
import {
  createEmptyWorkbenchState,
  appendWorkbenchArtifacts,
  loadWorkbenchState,
  replaceWorkbenchArtifacts,
  replaceWorkbenchTodos,
  saveWorkbenchState,
  type ThreadWorkbenchState,
} from "@/lib/workbench-state";
import {
  extractFinalSummary,
  inferTaskKindFromMessage,
  normalizeDelegationArtifacts,
  normalizeDelegationsToTodos,
  normalizeToolCallToArtifacts,
  normalizeToolCallToTodos,
} from "@/lib/tool-result-normalizer";
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
import { WorkbenchStatusNotice } from "@/components/WorkbenchStatusNotice";
import {
  resolveFirstRunState,
  type FirstRunState,
} from "@/lib/first-run-state";
import {
  resolveRecoverableActions,
  type RecoverableAction,
  type RecoverableErrorCode,
} from "@/lib/runtime-errors";
import {
  fetchCatalogStateFromUrl,
  type CatalogState,
} from "@/lib/preset-catalog";
import {
  STARTER_TEMPLATES,
  createStarterThread,
  type StarterTemplate,
  seedWorkbenchForStarterTemplate,
} from "@/lib/starter-templates";

export default function HomePage() {
  return (
    <React.Suspense fallback={null}>
      <HomePageContent />
    </React.Suspense>
  );
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
  const [recoverableError, setRecoverableError] =
    useState<RecoverableErrorCode | null>(null);
  const [pendingThreadRun, setPendingThreadRun] =
    useState<PendingThreadRun | null>(null);

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

  // ── Precise sub-agent tool renderers ──
  // Reference: showcase/integrations/langgraph-fastapi/demos/subagents/page.tsx
  useRenderTool({
    name: "planner_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => (
      <SubAgentActivityCard
        subAgent="planner"
        task={typeof parameters?.task === "string" ? parameters.task : undefined}
        status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
        result={typeof result === "string" ? result : undefined}
      />
    ),
  });

  useRenderTool({
    name: "executor_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => (
      <SubAgentActivityCard
        subAgent="executor"
        task={typeof parameters?.task === "string" ? parameters.task : undefined}
        status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
        result={typeof result === "string" ? result : undefined}
      />
    ),
  });

  useRenderTool({
    name: "reviewer_tool",
    parameters: z.object({ task: z.string().optional() }),
    render: ({ parameters, status, result }) => (
      <SubAgentActivityCard
        subAgent="reviewer"
        task={typeof parameters?.task === "string" ? parameters.task : undefined}
        status={status === "complete" ? "complete" : status === "executing" ? "executing" : "inProgress"}
        result={typeof result === "string" ? result : undefined}
      />
    ),
  });

  // ── Generic tool monitor for all other tools ──
  useRenderTool({
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

  // HITL: Agent interrupt handler for approval flows
  useInterrupt({
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

  // Welcome suggestions for new conversations
  useConfigureSuggestions({
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

  const [threads, setThreads] = useState<LocalThread[]>(() => loadThreads());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workbenchState, setWorkbenchState] = useState<ThreadWorkbenchState>(
    () => createEmptyWorkbenchState(),
  );
  const [loadedWorkbenchThreadId, setLoadedWorkbenchThreadId] = useState<string | null>(null);

  // Persist threads to localStorage on change
  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

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
      setRecoverableError(null);
    } catch {
      setRecoverableError("backend_unreachable");
    } finally {
      setCatalogChecking(false);
    }
  }, []);

  useEffect(() => {
    void reloadCatalogState();
  }, [reloadCatalogState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleRuntimeError = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      if (detail?.source === "copilotkit") {
        setRecoverableError("runtime_request_failed");
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
      findPresetById(ALL_AGENT_PRESETS, activeThread.presetId as AgentPresetId) ??
      null
    );
  }, [activeThread]);
  const activeAgentId = useMemo(() => {
    if (!currentPreset) return undefined;
    return resolveThreadAgentId(currentPreset.id, currentPreset.permissionMode);
  }, [currentPreset]);
  const { agent } = useAgent({
    agentId: activeAgentId,
  });

  useEffect(() => {
    if (!activeThread) {
      setLoadedWorkbenchThreadId(null);
      setWorkbenchState(createEmptyWorkbenchState());
      return;
    }
    setLoadedWorkbenchThreadId(null);
    setWorkbenchState(loadWorkbenchState(activeThread.id));
    setLoadedWorkbenchThreadId(activeThread.id);
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    if (loadedWorkbenchThreadId !== activeThread.id) return;
    saveWorkbenchState(activeThread.id, workbenchState);
  }, [activeThread, loadedWorkbenchThreadId, workbenchState]);

  useEffect(() => {
    if (!agent) return;

    const latestUserMessage = [...agent.messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage) return;

    const content = Array.isArray(latestUserMessage.content)
      ? latestUserMessage.content.join(" ")
      : String(latestUserMessage.content ?? "");
    const taskKind = inferTaskKindFromMessage(content);

    setWorkbenchState((previous) => {
      if (previous.taskKind === taskKind) {
        return previous;
      }
      return {
        ...previous,
        taskKind,
        updatedAt: Date.now(),
      };
    });
  }, [agent, agent?.messages]);

  useEffect(() => {
    if (!activeThread || !agent) return;

    const latestUserMessage = [...agent.messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage) return;

    const content = Array.isArray(latestUserMessage.content)
      ? latestUserMessage.content.join(" ")
      : String(latestUserMessage.content ?? "");
    const nextTitle = deriveThreadTitle(content);

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
  }, [activeThread, agent, agent?.messages]);

  useEffect(() => {
    if (!agent?.state || typeof agent.state !== "object") return;

    const state = agent.state as {
      delegations?: Array<{
        id: string;
        sub_agent: "planner" | "executor" | "reviewer";
        task: string;
        status: "running" | "completed" | "failed";
        result: string;
      }>;
      task_kind?: "engineering" | "research" | "general";
      final_summary?: string;
    };

    const delegations = Array.isArray(state.delegations) ? state.delegations : [];
    const taskKind = state.task_kind;
    const finalSummary = typeof state.final_summary === "string" && state.final_summary.trim()
      ? state.final_summary
      : null;

    if (delegations.length === 0 && !taskKind && !finalSummary) {
      return;
    }

    setWorkbenchState((previous) => {
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
  }, [agent, agent?.state]);

  // Share workspace context with the agent
  const workspaceContext = useMemo(
    () => ({
      workspaceRoot: process.env.AGENT_WORKSPACE_ROOT ?? "D:\\AgentBuild",
      projectName: "deep-agent-666",
      platform: "windows",
      shell: "powershell",
      currentThreadId: threadId ?? null,
      currentPresetId: currentPreset?.id ?? null,
    }),
    [threadId, currentPreset],
  );

  useAgentContext({
    description: "The user's local workspace environment — root path, platform, current thread and model preset",
    value: workspaceContext,
  });

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

  const handleSelectStarterTemplate = useCallback(
    (template: StarterTemplate) => {
      const presetId = resolveDefaultPresetId(catalogState.catalog);
      if (!presetId) {
        setSettingsOpen(true);
        return;
      }

      const thread = createStarterThread(presetId, template);
      const seededWorkbench = seedWorkbenchForStarterTemplate(template.category);

      saveWorkbenchState(thread.id, seededWorkbench);
      setThreads((previous) => [thread, ...previous]);
      setWorkbenchState(seededWorkbench);
      setLoadedWorkbenchThreadId(thread.id);
      setThreadId(thread.id);
      setRecoverableError(null);
      setPendingThreadRun({
        id: crypto.randomUUID(),
        threadId: thread.id,
        agentId: resolveThreadAgentId(presetId, findPresetById(ALL_AGENT_PRESETS, presetId)?.permissionMode ?? "balanced"),
        prompt: template.prompt,
      });
    },
    [catalogState.catalog, setThreadId],
  );

  const handleRecoveryAction = useCallback(
    (action: RecoverableAction["action"]) => {
      switch (action) {
        case "retry_connection":
          void reloadCatalogState();
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
          setRecoverableError(null);
          setPendingThreadRun({
            id: crypto.randomUUID(),
            threadId: activeThread.id,
            agentId: activeAgentId,
          });
          return;
      }
    },
    [activeAgentId, activeThread, handleNewThread, reloadCatalogState],
  );

  const settingsPreset =
    currentPreset ??
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
          onSaved={() => {
            setRecoverableError(null);
            void reloadCatalogState();
          }}
          onSaveFailed={(code) => setRecoverableError(code)}
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
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            id="thread-history"
            order={1}
            defaultSize={25}
            minSize={18}
            maxSize={40}
            className={`min-w-[280px] transition-all duration-300 ${sidebar ? "" : "!w-0 !min-w-0 !max-w-0 overflow-hidden"}`}
            collapsible
            collapsedSize={0}
          >
            <div className={`h-full ${sidebar ? "" : "hidden"}`}>
              <ThreadList
                threads={threads}
                activeThreadId={activeThread.id}
                onSelect={handleSelectThread}
                onClose={() => setSidebar(null)}
              />
            </div>
          </ResizablePanel>
          {sidebar && <ResizableHandle />}

          <ResizablePanel id="timeline" order={2} defaultSize={22} minSize={18}>
            <TaskTimelinePanel
              taskKind={workbenchState.taskKind}
              todos={workbenchState.todos}
            />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel id="chat" order={3}>
            <div className="flex h-full flex-col">
              {noticePresentation && effectiveRecoverableError ? (
                <WorkbenchStatusNotice
                  title={noticePresentation.title}
                  description={noticePresentation.description}
                  actions={resolveRecoverableActions(effectiveRecoverableError)}
                  onAction={handleRecoveryAction}
                />
              ) : null}
              {/* Model / Permission bar */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className="text-xs text-muted-foreground">Model:</span>
                <PresetSelector
                  presets={ALL_AGENT_PRESETS.filter(
                    (p) => p.provider === currentPreset.provider,
                  )}
                  value={activeThread.presetId as AgentPresetId}
                  onChange={handleSwitchPreset}
                />
                <span className="ml-4 text-xs text-muted-foreground">
                  Permission:
                </span>
                <PresetSelector
                  presets={ALL_AGENT_PRESETS.filter(
                    (p) => p.permissionMode === currentPreset.permissionMode,
                  )}
                  value={activeThread.presetId as AgentPresetId}
                  onChange={handleSwitchPreset}
                />
              </div>

              {/* Chat area */}
              <div className="flex-1 min-h-0 flex flex-col">
                {pendingThreadRun && pendingThreadRun.threadId === activeThread.id ? (
                  <CopilotChatConfigurationProvider
                    agentId={activeAgentId}
                    threadId={activeThread.id}
                  >
                    <PendingThreadRunController
                      key={pendingThreadRun.id}
                      run={pendingThreadRun}
                      onComplete={() => setPendingThreadRun(null)}
                      onError={() => setRecoverableError("runtime_request_failed")}
                    />
                  </CopilotChatConfigurationProvider>
                ) : null}
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
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel
            id="results"
            order={4}
            defaultSize={28}
            minSize={20}
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
        onSaved={() => {
          setRecoverableError(null);
          void reloadCatalogState();
        }}
        onSaveFailed={(code) => setRecoverableError(code)}
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
  onError: () => void;
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

    if (run.prompt) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: run.prompt,
      };
      agent.addMessage(message);
    }

    void copilotkit
      .runAgent({ agent })
      .catch(() => {
        onError();
      })
      .finally(() => {
        onComplete();
      });
  }, [agent, copilotkit, onComplete, onError, run]);

  return null;
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
    case "thread_missing_or_invalid":
      return {
        title: "Thread unavailable",
        description:
          "The selected thread is missing or no longer matches an available preset. Create a fresh thread to continue.",
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
  onSaved: () => void;
  onSaveFailed: (code: RecoverableErrorCode) => void;
}) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  if (!open) return null;

  const permissions = ["read-only", "balanced", "full-access"] as const;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      for (const cfg of PROVIDER_CONFIGS) {
        const key = apiKeys[cfg.key];
        if (key) body[cfg.apiKeyName] = key;
        const url = baseUrls[cfg.key];
        if (url) body[cfg.baseUrlName] = url;
      }
      const res = await fetch("http://127.0.0.1:8123/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "ok", text: `Configured — ${data.preset_count} presets available` });
        onSaved();
      } else {
        setMessage({ type: "error", text: "Failed to save configuration" });
        onSaveFailed("configuration_failed");
      }
    } catch {
      setMessage({ type: "error", text: "Backend is not running" });
      onSaveFailed("backend_unreachable");
    } finally {
      setSaving(false);
    }
  };

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={() => onOpenChange(false)}
      >
        <div
          className="w-full max-w-lg rounded-xl border border-border bg-white shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
        <h2 className="text-lg font-semibold text-card-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure provider API keys and base URLs.
        </p>

        {/* Provider / Permission selector */}
        <div className="mt-4 flex gap-4">
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
        <div className="mt-5 space-y-4">
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

        {message && (
          <p
            className={`mt-3 text-xs ${
              message.type === "ok" ? "text-green-600" : "text-destructive"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-[#D0D0D8] bg-white px-4 py-1.5 text-sm text-[#555] hover:bg-[#f5f5f5]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#7c6fe0] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#6a5ed0] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
