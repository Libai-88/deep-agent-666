"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

/**
 * Suppress the "Run ended without emitting a terminal event" error that
 * fires on mount when CopilotChat's connect-SSE stream closes without
 * a terminal event (expected for fresh threads).
 *
 * CopilotKit has a hardcoded console.error in its internal CopilotListeners
 * component that cannot be suppressed via the onError handler. We work
 * around it by temporarily intercepting console.error during the connect
 * phase.
 */
function SuppressConnectError({ children }: { children: ReactNode }) {
  useEffect(() => {
    const isConnectError = (msg: unknown) =>
      typeof msg === "string" &&
      msg.includes("Run ended without emitting a terminal event");

    const originalError = console.error;
    // Temporarily intercept console.error during the connect phase
    const patched = (...args: unknown[]) => {
      if (args.some(isConnectError)) return; // swallow
      originalError.apply(console, args);
    };
    console.error = patched;

    // Restore after connect completes (sync for fresh threads)
    const timer = setTimeout(() => {
      console.error = originalError;
    }, 2000);

    return () => {
      console.error = originalError;
      clearTimeout(timer);
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      credentials="include"
      onError={(event) => {
        // Silently ignore the known benign connect-stream error
        const err = (event as { error?: Error }).error;
        if (
          err?.message?.includes("Run ended without emitting a terminal event")
        )
          return;
        console.error("[copilotkit]", event);
      }}
    >
      <SuppressConnectError>{children}</SuppressConnectError>
    </CopilotKit>
  );
}
