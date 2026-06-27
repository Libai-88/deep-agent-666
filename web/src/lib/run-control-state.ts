import type { RecoverableErrorCode } from "@/lib/runtime-errors";

export type RunControlAction = "stop" | "retry" | "resume" | "edit_plan";

export type RunControlStatus =
  | "idle"
  | "running"
  | "waiting_approval"
  | "stopped"
  | "failed"
  | "completed";

export type RunControlState = {
  threadId: string | null;
  runId: string | null;
  status: RunControlStatus;
  currentStep: string | null;
  availableActions: RunControlAction[];
  pendingApproval: boolean;
  lastRecoverablePrompt: string | null;
  activeProviderId: string | null;
  activeModelId: string | null;
};

type ResolveRunControlStateInput = {
  threadId: string | null;
  runId?: string | null;
  runStatus: RunControlStatus;
  currentStep: string | null;
  activeProviderId: string | null;
  activeModelId: string | null;
  recoverableError: RecoverableErrorCode | null;
  lastRecoverablePrompt: string | null;
};

export function resolveRunControlState(
  input: ResolveRunControlStateInput,
): RunControlState {
  const availableActions: RunControlAction[] = [];

  if (input.runStatus === "running") {
    availableActions.push("stop");
  }

  if (input.runStatus === "waiting_approval") {
    availableActions.push("resume", "edit_plan");
  }

  if (input.lastRecoverablePrompt && input.recoverableError) {
    availableActions.push("retry");
  }

  return {
    threadId: input.threadId,
    runId: input.runId ?? null,
    status: input.runStatus,
    currentStep: input.currentStep,
    availableActions,
    pendingApproval: input.runStatus === "waiting_approval",
    lastRecoverablePrompt: input.lastRecoverablePrompt,
    activeProviderId: input.activeProviderId,
    activeModelId: input.activeModelId,
  };
}
