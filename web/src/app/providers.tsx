"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      showDevConsole
      onError={({ type, error, context }) => {
        console.error("[copilotkit]", type, error, context);
      }}
    >
      {children}
    </CopilotKit>
  );
}
