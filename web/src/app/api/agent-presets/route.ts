import { NextResponse } from "next/server";

import { getCatalogState } from "@/lib/runtime-state";

export const runtime = "nodejs";

export async function GET() {
  const state = await getCatalogState();

  return NextResponse.json({
    ...state.catalog,
    source: state.source,
  });
}
