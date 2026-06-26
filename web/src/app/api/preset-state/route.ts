import { loadRuntimeCatalog } from "@/lib/runtime-agents";

const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";

export const dynamic = "force-dynamic";

export async function GET() {
  const { catalog, source } = await loadRuntimeCatalog(BACKEND_URL);

  return Response.json({
    source,
    defaultPresetId: catalog.defaultPresetId,
    presets: catalog.presets,
  });
}
