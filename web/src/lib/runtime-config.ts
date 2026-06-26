export function resolveMcpAppsConfig(mcpServerUrl?: string) {
  if (!mcpServerUrl?.trim()) {
    return undefined;
  }

  return {
    servers: [
      {
        type: "http" as const,
        url: mcpServerUrl,
        serverId: "workspace-tools",
      },
    ],
  };
}
