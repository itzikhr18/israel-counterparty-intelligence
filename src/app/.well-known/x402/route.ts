import { NextResponse } from "next/server";

import { wellKnownX402Manifest } from "@/lib/well-known-x402";

export function GET() {
  return NextResponse.json(wellKnownX402Manifest(), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
