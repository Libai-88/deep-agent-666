"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileViewDialog } from "./FileViewDialog";

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface FileItem {
  path: string;
  content: string;
}

interface TasksFilesSidebarProps {
  todos: TodoItem[];
  files: FileItem[];
  onFileContentChange?: (path: string, content: string) => void;
}

export function TasksFilesSidebar({
  todos,
  files,
  onFileContentChange,
}: TasksFilesSidebarProps) {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const tasksOpen = todos.length > 0;
  const filesOpen = files.length > 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {todos.length > 0 && (
        <Section title="Tasks" icon={ListTodo} badge={todos.length} defaultOpen={tasksOpen}>
          <ul className="space-y-1.5">
            {todos.map((todo) => (
              <li key={todo.id} className="flex items-start gap-2 text-sm">
                {todo.status === "completed" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : todo.status === "in_progress" ? (
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-foreground",
                    todo.status === "completed" && "text-muted-foreground line-through",
                  )}
                >
                  {todo.content}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {files.length > 0 && (
        <Section title="Files" icon={FileText} badge={files.length} defaultOpen={filesOpen}>
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  onClick={() => setSelectedFile(file)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <span className="truncate font-mono text-xs">{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {todos.length === 0 && files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <ListTodo className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">No tasks or files yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px]">
            Ask the agent to create todos or write files — they'll appear here automatically
          </p>
        </div>
      )}

      <FileViewDialog
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
        onSave={onFileContentChange}
      />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{title}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          {badge}
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
