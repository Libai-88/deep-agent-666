"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CircleX, PanelRightClose } from "lucide-react";

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
  onClose: () => void;
}

export function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onClose,
}: ThreadListProps) {
  const [filter, setFilter] = useState<string>("all");
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    return filter === "all"
      ? threads
      : threads.filter((t) => t.presetId.includes(filter));
  }, [threads, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<GroupKey, LocalThread[]>();
    for (const thread of filtered) {
      const key = groupKey(new Date(thread.updatedAt));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(thread);
    }
    return groups;
  }, [filtered]);

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
                  <button
                    key={thread.id}
                    onClick={() => onSelect(thread.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      thread.id === activeThreadId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex-1 truncate font-medium">
                        {thread.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.updatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {thread.presetId}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
