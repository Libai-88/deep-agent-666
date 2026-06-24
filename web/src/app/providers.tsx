"use client";

import type { ReactNode } from "react";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      credentials="include"
      onError={({ code, error, context }) => {
        console.error("[copilotkit]", code, error, context);
      }}
    >
      {children}
    </CopilotKit>
  );
}
