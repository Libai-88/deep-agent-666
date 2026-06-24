"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopilotChat, useRenderTool } from "@copilotkit/react-core/v2";
import { useQueryState } from "nuqs";
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
  ClipboardList,
  FileText,
} from "lucide-react";
import { ThreadList } from "@/components/ThreadList";
import {
  createLocalThread,
  loadThreads,
  saveThreads,
  type LocalThread,
} from "@/lib/thread-registry";
import {
  ALL_AGENT_PRESETS,
  type AgentPresetDefinition,
  type AgentPresetId,
  findPresetById,
  resolveDefaultPresetId,
} from "@/lib/agent-presets";
import {
  TasksFilesSidebar,
  type TodoItem,
  type FileItem,
} from "@/components/TasksFilesSidebar";
import { ToolCallCard } from "@/components/ToolCallCard";

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
  const [sidebar, setSidebar] = useQueryState("sidebar");
  const [filesPanel, setFilesPanel] = useQueryState("files");
  const [threadId, setThreadId] = useQueryState("threadId");
  const [tasksOpen, setTasksOpen] = useState(false);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const processedKeys = useRef<Set<string>>(new Set());

  // Monitor tool calls via useRenderTool
  useRenderTool({
    name: "*",
    render: ({ name, status, args, result }) => {
      // Deduplication
      const key = `${name}-${JSON.stringify(args)}-${status}`;
      if (processedKeys.current.has(key)) {
        return <ToolCallCard name={name} status={status} args={args} result={result} />;
      }
      processedKeys.current.add(key);

      // Track write_todos tool calls
      if (name === "write_todos" && status === "complete" && args?.todos) {
        const newTodos = (args.todos as Array<{ content: string; status?: string }>).map(
          (t, i) => ({
            id: `todo-${Date.now()}-${i}`,
            content: t.content,
            status: (t.status ?? "pending") as TodoItem["status"],
          }),
        );
        // Use queueMicrotask to avoid state update during render
        queueMicrotask(() => {
          setTodos((prev) => [...prev, ...newTodos]);
          setTasksOpen(true);
        });
      }

      // Track write_file tool calls
      if (name === "write_file" && status === "complete" && args?.file_path) {
        queueMicrotask(() => {
          setFiles((prev) => [
            ...prev,
            {
              path: args.file_path as string,
              content: (result as string) ?? (args.content as string) ?? "",
            },
          ]);
        });
      }

      return <ToolCallCard name={name} status={status} args={args} result={result} />;
    },
  });

  const [threads, setThreads] = useState<LocalThread[]>(seedThreads);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          {!filesPanel && (todos.length > 0 || files.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilesPanel("1")}
              className="gap-2 text-xs text-muted-foreground"
            >
              <ClipboardList className="h-4 w-4" />
              Tasks ({todos.length})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          {sidebar && (
            <>
              <ResizablePanel
                id="thread-history"
                order={1}
                defaultSize={25}
                minSize={18}
                className="min-w-[280px]"
              >
                <ThreadList
                  threads={threads}
                  activeThreadId={activeThread.id}
                  onSelect={handleSelectThread}
                  onClose={() => setSidebar(null)}
                />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}

          <ResizablePanel id="chat" order={2}>
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
              <div className="flex-1 min-h-0">
                <CopilotChat
                  className="h-full"
                  agentId={activeThread.presetId}
                  threadId={activeThread.id}
                  labels={{
                    welcomeMessageText: "Hi! How can I help you today?",
                    chatInputPlaceholder: "Type a message...",
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          {filesPanel && (todos.length > 0 || files.length > 0) && (
            <>
              <ResizableHandle />
              <ResizablePanel
                id="tasks-files"
                order={3}
                defaultSize={20}
                minSize={15}
                className="min-w-[240px]"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <h2 className="text-xs font-semibold text-foreground">
                      Tasks & Files
                    </h2>
                    <button
                      onClick={() => setFilesPanel(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-pretty">
                    <TasksFilesSidebar todos={todos} files={files} />
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentPreset={currentPreset}
        onSwitchPreset={handleSwitchPreset}
      />
    </div>
  );
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
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
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      currentPreset.provider === cfg.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
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
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      currentPreset.permissionMode === perm
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
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
                placeholder="API Key (sk-...)"
                value={apiKeys[cfg.key] ?? ""}
                onChange={(e) =>
                  setApiKeys((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                placeholder={`Base URL (${cfg.defaultBaseUrl})`}
                value={baseUrls[cfg.key] ?? ""}
                onChange={(e) =>
                  setBaseUrls((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
