import { loadRuntimeCatalog } from "@/lib/runtime-agents";
import {
  buildRuntimeDiagnostics,
  type RuntimeDiagnostics,
} from "@/lib/runtime-diagnostics";
import {
  normalizeRuntimeSettings,
  type RuntimeSettings,
} from "@/lib/runtime-settings";

const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";

async function fetchBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchRuntimeSettings(baseUrl: string): Promise<RuntimeSettings> {
  try {
    const response = await fetch(`${baseUrl}/config`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return normalizeRuntimeSettings(null);
    }

    return normalizeRuntimeSettings((await response.json()) as unknown);
  } catch {
    return normalizeRuntimeSettings(null);
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const [{ catalog, source }, backendReachable, runtimeSettings] =
    await Promise.all([
      loadRuntimeCatalog(BACKEND_URL),
      fetchBackendHealth(BACKEND_URL),
      fetchRuntimeSettings(BACKEND_URL),
    ]);

  const diagnostics: RuntimeDiagnostics = buildRuntimeDiagnostics({
    backendReachable,
    catalogSource: source,
    launchablePresetCount: catalog.presets.length,
    runtimeSettings,
  });

  return Response.json(diagnostics);
}
