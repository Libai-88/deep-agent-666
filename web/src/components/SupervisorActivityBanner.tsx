"use client";

import React from "react";
import type { SubAgentName } from "./DelegationLog";

const LABELS: Record<SubAgentName, string> = {
  planner: "Planner",
  executor: "Executor",
  reviewer: "Reviewer",
};

export function SupervisorActivityBanner({
  subAgent,
  task,
}: {
  subAgent: SubAgentName;
  task: string;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-[#E9E9EF] bg-[#FAFAFC] px-4 py-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#010507]" />
      <div className="min-w-0 text-xs text-[#010507]">
        <span className="font-semibold">{LABELS[subAgent]}</span>
        <span className="text-[#57575B]"> is running:</span>{" "}
        <span className="text-[#57575B] line-clamp-2">{task}</span>
      </div>
    </div>
  );
}
