"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

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
