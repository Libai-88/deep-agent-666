"use client";

import {
  useDefaultRenderTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";

export function ToolCallRenderers() {
  useDefaultRenderTool();

  useRenderTool(
    {
      name: "run_command_tool",
      parameters: z.object({
        command: z.string(),
        cwd: z.string().optional(),
      }),
      render: ({ status, parameters, result }) => (
        <div
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}
        >
          <strong>PowerShell</strong>
          <div>{parameters.command}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{status}</div>
          {status === "complete" ? (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          ) : null}
        </div>
      ),
    },
    [],
  );

  useRenderTool(
    {
      name: "read_document_tool",
      parameters: z.object({ path: z.string() }),
      render: ({ status, parameters }) => (
        <div
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}
        >
          <strong>Document</strong>
          <div>{parameters.path}</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{status}</div>
        </div>
      ),
    },
    [],
  );

  return null;
}
