import { NextResponse } from "next/server";

import { wellKnownX402Manifest } from "@/lib/well-known-x402";

export function GET() {
  return NextResponse.json(wellKnownX402Manifest(), {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
