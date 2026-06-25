"use client";

import React, { useState, useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Timer,
  Bot,
} from "lucide-react";

interface V2State {
  phase: "idle" | "planning" | "executing" | "reviewing" | "done";
  plan_steps?: Array<{ step: string; done?: boolean }>;
  completed_steps?: Array<{ step: string }>;
  review_result?: string | null;
}

const phaseConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  label: string;
}> = {
  planning:  { icon: Timer,    color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", label: "Planning" },
  executing: { icon: Loader2,  color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950", label: "Executing" },
  reviewing: { icon: CheckCircle2, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950", label: "Reviewing" },
  done:      { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", label: "Complete" },
  idle:      { icon: Timer,    color: "text-gray-400", bg: "bg-gray-50 dark:bg-gray-900", label: "Idle" },
};

export function SubAgentProgress({ agentId, className }: { agentId?: string; className?: string }) {
  let agentHook: { agent?: { state: unknown; subscribe: (opts: { onStateChanged: () => void }) => { unsubscribe: () => void } } } = {};
  try {
    agentHook = useAgent({ agentId: agentId ?? "coordinator" });
  } catch {
    return null;
  }
  const { agent } = agentHook;
  const [state, setState] = useState<V2State | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!agent) return;
    setState(agent.state as V2State);
    const sub = agent.subscribe({
      onStateChanged: () => {
        setState(agent.state as V2State);
      },
    });
    return () => { try { sub.unsubscribe(); } catch {} };
  }, [agent]);

  if (!state?.phase || state.phase === "idle") return null;

  const phase = phaseConfig[state.phase] ?? phaseConfig.idle;
  const Icon = phase.icon;
  const stepCount = state.plan_steps?.length ?? 0;
  const doneCount = state.completed_steps?.length ?? 0;

  return (
    <div className={`mx-4 my-2 rounded-lg border border-border ${phase.bg} p-3 ${className ?? ""}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        }
        <Icon className={`h-4 w-4 shrink-0 ${phase.color} ${state.phase === "executing" ? "animate-spin" : ""}`} />
        <span className="text-xs font-medium text-foreground">{phase.label}</span>
        {stepCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{stepCount} steps
          </span>
        )}
        {state.phase === "done" && (
          <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
        )}
      </button>

      {expanded && state.plan_steps && state.plan_steps.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-6">
          {state.plan_steps.map((step, i) => {
            const done = state.completed_steps?.some((c) => c.step === step.step);
            return (
              <div key={i} className="flex items-start gap-2 text-xs">
                {done
                  ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                  : <Loader2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground animate-spin" />
                }
                <span className={done ? "text-green-700 dark:text-green-400" : "text-foreground"}>
                  {step.step}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
