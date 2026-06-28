export type RunControlAction = "approve_plan" | "edit_plan" | "retry_last" | "request_stop";

export type RunControlStatus =
  | "idle"
  | "running"
  | "interrupted"
  | "resuming"
  | "completed"
  | "failed"
  | "cancellation_requested"
  | "cancelled"
  | "cancelling";

export type RunControlSnapshot = {
  phase: RunControlStatus;
  reason: "none" | "plan_approval" | "tool_approval" | "user_stop" | "error";
  currentStep: string | null;
  statusMessage: string;
  availableActions: RunControlAction[];
  interruptPayload: Record<string, unknown> | null;
  threadId: string | null;
  runId: string | null;
  activeProviderId: string | null;
  activeModelId: string | null;
};

export type RunControlState = {
  threadId: string | null;
  runId: string | null;
  status: RunControlStatus;
  currentStep: string | null;
  availableActions: RunControlAction[];
  pendingApproval: boolean;
  activeProviderId: string | null;
  activeModelId: string | null;
};

type ResolveRunControlStateInput = {
  threadId: string | null;
  runId?: string | null;
  runtimeControl: RunControlSnapshot | null;
  activeProviderId: string | null;
  activeModelId: string | null;
};

export function resolveRunControlState(
  input: ResolveRunControlStateInput,
): RunControlState {
  const snapshot = input.runtimeControl;
  if (!snapshot) {
    return {
      threadId: input.threadId,
      runId: input.runId ?? null,
      status: "idle",
      currentStep: null,
      availableActions: [],
      pendingApproval: false,
      activeProviderId: input.activeProviderId,
      activeModelId: input.activeModelId,
    };
  }

  return {
    threadId: input.threadId,
    runId: snapshot.runId ?? input.runId ?? null,
    status: snapshot.phase,
    currentStep: snapshot.currentStep,
    availableActions: snapshot.availableActions,
    pendingApproval: snapshot.phase === "interrupted" && snapshot.reason === "plan_approval",
    activeProviderId: snapshot.activeProviderId ?? input.activeProviderId,
    activeModelId: snapshot.activeModelId ?? input.activeModelId,
  };
}
