"use client";

import type { LocalThread } from "@/lib/thread-registry";

type ThreadSidebarProps = {
  threads: LocalThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
};

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
}: ThreadSidebarProps) {
  return (
    <aside
      style={{
        padding: 16,
        borderRight: "1px solid var(--line)",
        minWidth: 240,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Threads</h2>
        <button onClick={onCreateThread} type="button">
          New
        </button>
      </div>
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onSelectThread(thread.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            marginBottom: 8,
            padding: 10,
            borderRadius: 12,
            border:
              thread.id === activeThreadId
                ? "1px solid var(--accent)"
                : "1px solid var(--line)",
            background: "var(--panel)",
          }}
          type="button"
        >
          <strong>{thread.title}</strong>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            {thread.presetId}
          </div>
        </button>
      ))}
    </aside>
  );
}
