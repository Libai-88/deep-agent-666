"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { HttpAgent } from "@ag-ui/client";
import "@copilotkit/react-core/v2/styles.css";

const AGENT_BASE_URL = "http://127.0.0.1:8123";

/**
 * Connect the browser's @ag-ui/client directly to the Python backend's
 * add_langgraph_fastapi_endpoint. This bypasses the CopilotKit Runtime handler
 * (which doesn't forward RUN_FINISHED correctly), avoiding INCOMPLETE_STREAM.
 *
 * HttpAgent sends POST {url} with RunAgentInput, expects SSE stream.
 * The backend responds with proper AG-UI events (verified: RUN_FINISHED emitted).
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
