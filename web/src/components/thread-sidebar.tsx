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
    <aside className="wb-sidebar">
      <div className="wb-sidebar__header">
        <span className="wb-sidebar__title">Threads</span>
        <button
          className="wb-sidebar__newBtn"
          onClick={onCreateThread}
          type="button"
        >
          + New
        </button>
      </div>
      {threads.map((thread) => (
        <button
          key={thread.id}
          className="wb-thread"
          data-active={thread.id === activeThreadId}
          onClick={() => onSelectThread(thread.id)}
          type="button"
        >
          <span className="wb-thread__title">{thread.title}</span>
          <span className="wb-thread__meta">{thread.presetId}</span>
        </button>
      ))}
    </aside>
  );
}
