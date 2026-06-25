"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { HttpAgent } from "@ag-ui/client";
import "@copilotkit/react-core/v2/styles.css";

const AGENT_BASE_URL = "http://127.0.0.1:8123";

/**
 * Direct browser HttpAgent → Python backend via CORS.
 * This bypasses the CopilotKit Runtime entirely, avoiding a cascade
 * of protocol format issues between CopilotKit v2 and the Python SDK.
 *
 * Trade-off: Chat messages produce INCOMPLETE_STREAM client-side error
 * (Python ag-ui-langgraph SSE format vs JS @ag-ui/client expectations).
 * But page load, V2 state, and all UI components work correctly.
 */
const agents = {
  "default": new HttpAgent({ url: `${AGENT_BASE_URL}/openai-balanced` }),
  "openai-read-only": new HttpAgent({ url: `${AGENT_BASE_URL}/openai-read-only` }),
  "openai-balanced": new HttpAgent({ url: `${AGENT_BASE_URL}/openai-balanced` }),
  "openai-full-access": new HttpAgent({ url: `${AGENT_BASE_URL}/openai-full-access` }),
  "coordinator-openai-balanced": new HttpAgent({ url: `${AGENT_BASE_URL}/coordinator-openai-balanced` }),
  "coordinator-openai-full-access": new HttpAgent({ url: `${AGENT_BASE_URL}/coordinator-openai-full-access` }),
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      agents__unsafe_dev_only={agents}
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
