"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

/**
 * Connect the frontend to the CopilotKit Runtime (Next.js route handler).
 * The Runtime uses server-side HttpAgent instances to proxy requests to
 * the Python backend at http://127.0.0.1:8123/{agentId}.
 *
 * This avoids the INCOMPLETE_STREAM bug caused by direct browser HttpAgent
 * connections — the Runtime handles thread lifecycle (connect/run/stop)
 * and properly forwards RUN_FINISHED events to the client.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      credentials="include"
      onError={(event) => {
        console.error("[copilotkit]", event);
      }}
    >
      {children}
    </CopilotKit>
  );
}
