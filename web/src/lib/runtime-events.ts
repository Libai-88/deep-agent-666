type ToolPayload = {
  name?: string;
  status?: string;
  args?: Record<string, unknown> | null;
  result?: unknown;
};

export type WorkbenchEventStatus =
  | "running"
  | "completed"
  | "failed"
  | "info";

export type WorkbenchEventKind =
  | "delegation"
  | "tool"
  | "artifact"
  | "status";

export type WorkbenchEventSource =
  | "planner"
  | "executor"
  | "reviewer"
  | "tool"
  | "system";

export type WorkbenchEvent = {
  id: string;
  kind: WorkbenchEventKind;
  status: WorkbenchEventStatus;
  title: string;
  message: string;
  source: WorkbenchEventSource;
  createdAt: number;
  artifactPath?: string;
  artifactKind?: "file" | "finding" | "summary";
};

type SnapshotEventPayload = {
  id?: unknown;
  kind?: unknown;
  status?: unknown;
  title?: unknown;
  message?: unknown;
  source?: unknown;
  artifact_path?: unknown;
  artifact_kind?: unknown;
};

type StructuredEditResult = {
  summary?: unknown;
  path?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseStructuredEditResult(result: unknown): StructuredEditResult | null {
  if (isRecord(result)) {
    return result as StructuredEditResult;
  }

  if (typeof result !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(result) as unknown;
    return isRecord(parsed) ? (parsed as StructuredEditResult) : null;
  } catch {
    return null;
  }
}

function normalizeEventStatus(value: unknown): WorkbenchEventStatus {
  if (value === "running" || value === "completed" || value === "failed") {
    return value;
  }
  return "info";
}

function normalizeEventKind(value: unknown): WorkbenchEventKind {
  if (
    value === "delegation" ||
    value === "tool" ||
    value === "artifact" ||
    value === "status"
  ) {
    return value;
  }
  return "status";
}

function normalizeEventSource(value: unknown): WorkbenchEventSource {
  if (
    value === "planner" ||
    value === "executor" ||
    value === "reviewer" ||
    value === "system"
  ) {
    return value;
  }
  return "tool";
}

function resolveActivityTitle(
  kind: WorkbenchEventKind,
  source: WorkbenchEventSource,
  status: WorkbenchEventStatus,
  title: string,
  message: string,
): string {
  if (kind !== "status") {
    return title;
  }

  const lower = `${title} ${message}`.toLowerCase();

  if (source === "planner") {
    return status === "completed" ? "Plan ready" : "Planning next steps";
  }

  if (source === "reviewer") {
    return status === "completed" ? "Review complete" : "Reviewing results";
  }

  if (source === "executor") {
    if (
      lower.includes("replace text") ||
      lower.includes("write file") ||
      lower.includes("write text") ||
      lower.includes("edit file") ||
      lower.includes("implement") ||
      lower.includes("code")
    ) {
      return "Writing code";
    }

    if (
      lower.includes("read ") ||
      lower.includes("inspect") ||
      lower.includes("search") ||
      lower.includes("analy")
    ) {
      return "Inspecting files";
    }

    return status === "completed" ? "Execution complete" : "Running task";
  }

  return title;
}

export function normalizeSnapshotEvents(input: unknown): WorkbenchEvent[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(isRecord)
    .map((rawEvent, index) => {
      const event = rawEvent as SnapshotEventPayload;
      const artifactKind =
        event.artifact_kind === "file" ||
        event.artifact_kind === "finding" ||
        event.artifact_kind === "summary"
          ? event.artifact_kind
          : undefined;
      const kind = normalizeEventKind(event.kind);
      const status = normalizeEventStatus(event.status);
      const source = normalizeEventSource(event.source);
      const title =
        typeof event.title === "string" ? event.title : "Workbench event";
      const message = typeof event.message === "string" ? event.message : "";

      return {
        id: typeof event.id === "string" ? event.id : `snapshot-${index}`,
        kind,
        status,
        title: resolveActivityTitle(kind, source, status, title, message),
        message,
        source,
        createdAt: Date.now() + index,
        artifactPath:
          typeof event.artifact_path === "string"
            ? event.artifact_path
            : undefined,
        artifactKind,
      };
    });
}

export function normalizeToolPayloadToEvents(
  payload: ToolPayload,
): WorkbenchEvent[] {
  if (payload.status !== "complete") {
    return [];
  }

  const structuredResult = parseStructuredEditResult(payload.result);
  const artifactPath =
    typeof payload.args?.path === "string"
      ? payload.args.path
      : typeof payload.args?.file_path === "string"
        ? payload.args.file_path
        : typeof structuredResult?.path === "string"
          ? structuredResult.path
          : undefined;
  const summary =
    typeof structuredResult?.summary === "string"
      ? structuredResult.summary
      : typeof payload.result === "string"
        ? payload.result
        : null;

  if (
    payload.name === "write_text_file_tool" ||
    payload.name === "replace_text_in_file_tool" ||
    payload.name === "write_file"
  ) {
    return [
      {
        id: `tool-event-${Date.now()}-artifact`,
        kind: "artifact",
        status: "completed",
        title: summary ?? payload.name,
        message: summary ?? payload.name ?? "Tool completed",
        source: "tool",
        createdAt: Date.now(),
        artifactPath,
        artifactKind: "file",
      },
    ];
  }

  return [];
}
