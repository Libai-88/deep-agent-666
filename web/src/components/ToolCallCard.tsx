"use client";

import React, { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Terminal, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCallCardProps {
  name: string;
  status: "inProgress" | "executing" | "complete";
  args: Record<string, unknown>;
  result?: unknown;
}

const TOOL_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  write_todos: { icon: CheckCircle2, label: "Updating tasks..." },
  read_todos: { icon: CheckCircle2, label: "Checking tasks..." },
  research: { icon: Terminal, label: "Researching..." },
  write_file: { icon: Terminal, label: "Writing file..." },
  read_file: { icon: Terminal, label: "Reading file..." },
  list_workspace: { icon: Terminal, label: "Listing workspace..." },
  search_workspace: { icon: Terminal, label: "Searching workspace..." },
  read_text_file: { icon: Terminal, label: "Reading file..." },
  read_document: { icon: Terminal, label: "Reading document..." },
  run_command: { icon: Terminal, label: "Running command..." },
};

export function ToolCallCard({ name, status, args, result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TOOL_CONFIG[name];
  const Icon = config?.icon ?? Terminal;
  const isRunning = status === "inProgress" || status === "executing";
  const isDone = status === "complete";

  const label = config?.label ?? `Executing ${name}...`;

  return (
    <div
      className={cn(
        "my-2 overflow-hidden rounded-lg border border-border bg-card text-sm transition-colors",
        isRunning && "border-l-2 border-l-primary",
        isDone && "border-l-2 border-l-green-500",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : isDone ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        ) : (
          <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-foreground">{label}</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          {Object.keys(args).length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Arguments</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && result !== null && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Result</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
                {typeof result === "string"
                  ? result.length > 500
                    ? result.slice(0, 500) + "..."
                    : result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
