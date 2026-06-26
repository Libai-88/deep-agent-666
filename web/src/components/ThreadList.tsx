"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Pencil, PanelRightClose, Trash2, X } from "lucide-react";

import type { AgentPresetId } from "@/lib/agent-presets";
import type { LocalThread } from "@/lib/thread-registry";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type GroupKey = "today" | "yesterday" | "week" | "older";

function groupKey(date: Date): GroupKey {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const day = 86_400_000;

  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return "week";
  return "older";
}

const GROUP_LABELS: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Previous 7 Days",
  older: "Older",
};

interface ThreadListProps {
  threads: LocalThread[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onRename,
  onDelete,
  onClose,
}: ThreadListProps) {
  const [filter, setFilter] = useState<string>("all");
  const [loading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  // Defer date-dependent rendering to client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    return filter === "all"
      ? threads
      : threads.filter((t) => t.presetId.includes(filter));
  }, [threads, filter]);

  const grouped = useMemo(() => {
    if (!mounted) return new Map<GroupKey, LocalThread[]>();
    const groups = new Map<GroupKey, LocalThread[]>();
    for (const thread of filtered) {
      const key = groupKey(new Date(thread.updatedAt));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(thread);
    }
    return groups;
  }, [filtered, mounted]);

  const commitRename = (thread: LocalThread) => {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== thread.title) {
      onRename(thread.id, nextTitle);
    }
    setEditingThreadId(null);
    setDraftTitle("");
  };

  const cancelRename = () => {
    setEditingThreadId(null);
    setDraftTitle("");
  };

  const handleRenameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    thread: LocalThread,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(thread);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="flex h-full flex-col panel-enter">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Threads</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {threads.some((t) => t.presetId !== "openai-balanced") && (
        <div className="flex gap-1 border-b border-border px-3 py-2">
          {["all", "openai", "anthropic", "google"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`rounded px-2 py-0.5 text-xs ${
                filter === opt
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt === "all" ? "All" : opt}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          {loading ? (
            <div className="flex flex-col gap-3 p-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No threads
            </p>
          ) : (
            Array.from(grouped.entries()).map(([key, items]) => (
              <div key={key} className="mb-4">
                <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  {GROUP_LABELS[key]}
                </p>
                {items.map((thread) => (
                  <div
                    key={thread.id}
                    data-testid={`thread-item-${thread.id}`}
                    data-active={thread.id === activeThreadId ? "true" : "false"}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      thread.id === activeThreadId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {editingThreadId === thread.id ? (
                        <div className="min-w-0 flex-1">
                          <input
                            autoFocus
                            data-testid={`thread-title-input-${thread.id}`}
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            onKeyDown={(event) => handleRenameKeyDown(event, thread)}
                            className="w-full rounded border border-border bg-background px-2 py-1 text-sm font-medium text-foreground outline-none"
                          />
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {thread.presetId}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(thread.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="flex-1 truncate font-medium">
                            {thread.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {thread.presetId}
                          </span>
                        </button>
                        )}
                      <div className="flex shrink-0 items-center gap-1">
                        {editingThreadId === thread.id ? (
                          <>
                            <button
                              type="button"
                              data-testid={`thread-rename-save-${thread.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                commitRename(thread);
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Save thread title"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              data-testid={`thread-rename-cancel-${thread.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelRename();
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Cancel thread rename"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              data-testid={`thread-rename-${thread.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingThreadId(thread.id);
                                setDraftTitle(thread.title);
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Rename ${thread.title}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              data-testid={`thread-delete-${thread.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDelete(thread.id);
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                              aria-label={`Delete ${thread.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <span className="ml-1 shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(thread.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
