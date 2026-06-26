"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  CopilotChat,
  useRenderTool,
  useInterrupt,
  useConfigureSuggestions,
  useAgentContext,
  useAgent,
} from "@copilotkit/react-core/v2";
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
import { DelegationLog } from "@/components/DelegationLog";
import { SupervisorActivityBanner } from "@/components/SupervisorActivityBanner";
import { FileBrowser } from "@/components/FileBrowser";
import { FileViewDialog } from "@/components/FileViewDialog";
import { TaskTimelinePanel } from "@/components/TaskTimelinePanel";
import { ArtifactResultsPanel } from "@/components/ArtifactResultsPanel";

function seedThreads(): LocalThread[] {
  const stored = loadThreads();
  if (stored.length > 0) return stored;
  const defaultId = resolveDefaultPresetId({
    defaultPresetId: "openai-balanced",
    presets: [...ALL_AGENT_PRESETS],
  });
  return defaultId ? [createLocalThread(defaultId)] : [];
}

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

  const [threads, setThreads] = useState<LocalThread[]>(seedThreads);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workbenchState, setWorkbenchState] = useState<ThreadWorkbenchState>(
    () => createEmptyWorkbenchState(),
  );
  const [loadedWorkbenchThreadId, setLoadedWorkbenchThreadId] = useState<string | null>(null);

  // Persist threads to localStorage on change
  useEffect(() => {
    saveThreads(threads);
  }, [threads]);

  const activeThread = useMemo(
    () =>
      threads.find((t) => t.id === (threadId ?? threads[0]?.id)) ??
      threads[0] ??
      null,
    [threads, threadId],
  );

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
    if (!activeThread) return;
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

  const handleNewThread = useCallback(() => {
    const defaultId = resolveDefaultPresetId({
      defaultPresetId: "openai-balanced",
      presets: [...ALL_AGENT_PRESETS],
    });
    if (!defaultId) return;
    const thread = createLocalThread(defaultId);
    setThreads((prev) => [thread, ...prev]);
    setThreadId(thread.id);
  }, [setThreadId]);

  const handleSelectThread = useCallback(
    (id: string) => {
      setThreadId(id);
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

  if (!currentPreset || !activeThread) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Assistant</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No configured agent presets are available. Add at least one provider key.
          </p>
        </div>
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
        currentPreset={currentPreset}
        onSwitchPreset={handleSwitchPreset}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPreset: AgentPresetDefinition;
  onSwitchPreset: (id: AgentPresetId) => void;
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
      } else {
        setMessage({ type: "error", text: "Failed to save configuration" });
      }
    } catch {
      setMessage({ type: "error", text: "Backend is not running" });
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
