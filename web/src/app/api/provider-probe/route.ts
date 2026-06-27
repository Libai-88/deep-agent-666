const BACKEND_URL = process.env.AGENT_BASE_URL ?? "http://127.0.0.1:8123";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = await fetch(`${BACKEND_URL}/providers/probe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: await request.text(),
  });

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

  return Response.json((await response.json()) as unknown);
}
