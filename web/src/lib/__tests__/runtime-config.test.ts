import { describe, expect, it } from "vitest";

import { resolveMcpAppsConfig } from "../runtime-config";

describe("runtime-config", () => {
  it("omits MCP app wiring when no MCP server url is configured", () => {
    expect(resolveMcpAppsConfig()).toBeUndefined();
    expect(resolveMcpAppsConfig("")).toBeUndefined();
  });

  it("returns the workspace-tools MCP server when a url is configured", () => {
    expect(resolveMcpAppsConfig("http://127.0.0.1:3108/mcp")).toEqual({
      servers: [
        {
          type: "http",
          url: "http://127.0.0.1:3108/mcp",
          serverId: "workspace-tools",
        },
      ],
    });
  });
});
