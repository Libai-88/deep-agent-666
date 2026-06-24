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
        <div className="wb-tool">
          <div className="wb-tool__name">PowerShell</div>
          <div className="wb-tool__detail">{parameters.command}</div>
          <div className="wb-tool__status">{status}</div>
          {status === "complete" ? (
            <pre className="wb-tool__result">{JSON.stringify(result, null, 2)}</pre>
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
        <div className="wb-tool">
          <div className="wb-tool__name">Document</div>
          <div className="wb-tool__detail">{parameters.path}</div>
          <div className="wb-tool__status">{status}</div>
        </div>
      ),
    },
    [],
  );

  return null;
}
