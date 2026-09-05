import type { NextRequest } from "next/server";

// No invoice fields, company identifiers, IPs, cookies, or wallet data.
export function logInvoiceFunnel(
  request: NextRequest,
  event:
    | "invoice_preview_invalid"
    | "invoice_preview_delivered"
    | "invoice_request_downloaded"
    | "invoice_download_blocked",
  outcome?: {
    action: "PAY" | "HOLD" | "BLOCK";
    allocationApplicability: "REQUIRED" | "NOT_REQUIRED" | "UNKNOWN";
  },
) {
  console.info(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      client_class:
        request.headers.get("x-discovery-source") ===
        "internal-post-deploy-smoke"
          ? "internal_test"
          : "external",
      transport: "browser_form",
      decision: outcome?.action ?? null,
      allocation_applicability: outcome?.allocationApplicability ?? null,
      telemetry_version: "1.5",
    }),
  );
}
