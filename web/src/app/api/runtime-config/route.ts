import { normalizeRuntimeSettings } from "@/lib/runtime-settings";

const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";

export const dynamic = "force-dynamic";

async function proxyJson(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, init);
  } catch (error) {
    if (path === "/config") {
      return Response.json(normalizeRuntimeSettings(null));
    }

    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  }

  const payload = (await response.json()) as unknown;

  if (path === "/config") {
    return Response.json(normalizeRuntimeSettings(payload));
  }

  return Response.json(payload);
}

export async function GET() {
  return proxyJson("/config", {
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  return proxyJson("/configure", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: await request.text(),
  });
}
