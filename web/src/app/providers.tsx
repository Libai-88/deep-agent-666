"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

/**
 * Filter out known false-positive errors that fire during React Strict Mode
 * double-mount or when the SSE connect stream closes on an empty thread.
 *
 * "Run ended without emitting a terminal event" (INCOMPLETE_STREAM) is
 * emitted by CopilotKit's `finalizeRunEvents` when the connect-SSE stream
 * completes without a terminal event — this is expected for fresh threads
 * and React strict-mode double-mounts.
 */
function isIgnorableCopilotError(event: unknown): boolean {
  if (!event || typeof event !== "object") return true;
  const e = event as Record<string, unknown>;
  // Empty / unstructured error objects — safe to ignore
  const keys = Object.keys(e);
  if (keys.length === 0) return true;
  // Check the nested error object
  const err = e.error as Error | undefined;
  if (err?.message?.includes("Run ended without emitting a terminal event")) return true;
  if (err?.message?.includes("INCOMPLETE_STREAM")) return true;
  // Check code field
  if (e.code === "agent_run_error_event") {
    const ctx = e.context as Record<string, unknown> | undefined;
    if (ctx?.source === "onRunErrorEvent") {
      const runtimeErr = ctx?.runtimeErrorCode;
      if (runtimeErr === "INCOMPLETE_STREAM") return true;
    }
  }
  return false;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      credentials="include"
      onError={(event) => {
        if (isIgnorableCopilotError(event)) return;
        console.error("[copilotkit]", event);
      }}
    >
      {children}
    </CopilotKit>
  );
}
