"use client";

import React from "react";
import type { SubAgentName } from "./DelegationLog";

export type SubAgentToolStatus = "inProgress" | "executing" | "complete";

const SUB_AGENT_META: Record<
  SubAgentName,
  { label: string; role: string; emoji: string; accent: string; chip: string }
> = {
  planner: {
    label: "Planner",
    role: "planning the task",
    emoji: "📋",
    accent: "border-[#BEC2FF] bg-[#BEC2FF]/15",
    chip: "border-[#BEC2FF] bg-[#BEC2FF1A] text-foreground",
  },
  executor: {
    label: "Executor",
    role: "executing steps",
    emoji: "⚡",
    accent: "border-[#85ECCE4D] bg-[#85ECCE]/10",
    chip: "border-[#85ECCE4D] bg-[#85ECCE]/20 text-emerald-700",
  },
  reviewer: {
    label: "Reviewer",
    role: "reviewing results",
    emoji: "🧐",
    accent: "border-[#FFAC4D33] bg-[#FFAC4D]/10",
    chip: "border-[#FFAC4D33] bg-[#FFAC4D]/15 text-muted-foreground",
  },
};

export interface SubAgentActivityCardProps {
  subAgent: SubAgentName;
  task: string | undefined;
  status: SubAgentToolStatus;
  result: string | undefined;
}

export function SubAgentActivityCard({
  subAgent,
  task,
  status,
  result,
}: SubAgentActivityCardProps) {
  const meta = SUB_AGENT_META[subAgent];
  const done = status === "complete";
  const running = !done;

  return (
    <div
      data-testid={`subagent-card-${subAgent}`}
      className={`my-3 overflow-hidden rounded-2xl border bg-background shadow-sm ${meta.accent}`}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base leading-none">{meta.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{meta.label}</span>
          <span className="text-[11px] text-muted-foreground">
            {running ? `is ${meta.role}…` : `finished ${meta.role}`}
          </span>
        </div>
        <StatusBadge status={status} chipTone={meta.chip} />
      </div>

      <div className="grid gap-3 p-4 text-sm">
        <Section label="Task">
          {task ? (
            <p className="rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-foreground whitespace-pre-wrap">
              {task}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              waiting for the supervisor to spell out the task…
            </p>
          )}
        </Section>

        <Section label="Result">
          {done ? (
            <div className="rounded-lg border border-border bg-background p-2.5 text-xs text-foreground whitespace-pre-wrap">
              {result?.trim() ? result : "(empty)"}
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 text-xs italic text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
              {meta.label} is working…
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status, chipTone }: { status: SubAgentToolStatus; chipTone: string }) {
  const label = describeStatus(status);
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${chipTone}`}
    >
      {label}
    </span>
  );
}

function describeStatus(status: SubAgentToolStatus): string {
  switch (status) {
    case "inProgress": return "starting";
    case "executing":  return "running";
    case "complete":   return "done";
  }
}
