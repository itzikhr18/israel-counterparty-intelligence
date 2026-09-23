import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { renderProofPage } from "@/lib/proof-page";

export async function GET() {
  return new NextResponse(renderProofPage({ providerName: config.PROVIDER_NAME }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}
