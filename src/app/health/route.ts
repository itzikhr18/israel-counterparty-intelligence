import { NextResponse } from "next/server";

import { API_VERSION } from "@/lib/domain";

export async function GET() {
  return NextResponse.json(
    { status: "ok", version: API_VERSION, timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
