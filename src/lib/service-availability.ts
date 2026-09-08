import { NextResponse } from "next/server";

// Deliberately independent of x402 configuration: disabling payment verification
// must never reopen paid reports. Resumption requires a reviewed code release.
export const PAID_SERVICE_SUSPENDED = true;

export const PAID_SERVICE_NOTICE =
  "Paid reports and x402 payments are temporarily suspended pending commercial-readiness review. Free previews remain available. Do not sign or send a payment.";

type UnavailableReason = "suspended" | "disabled";

export function paidServiceUnavailableBody(
  reason: UnavailableReason = "suspended",
) {
  return {
    error: {
      code:
        reason === "suspended"
          ? "PAID_SERVICE_SUSPENDED"
          : "PAYMENT_PROCESSING_DISABLED",
      message:
        reason === "suspended"
          ? PAID_SERVICE_NOTICE
          : "Payment processing is disabled in this environment. Paid reports are unavailable. Do not sign or send a payment.",
    },
    payment_attempted: false,
  };
}

export function paidServiceUnavailableResponse(
  reason: UnavailableReason = "suspended",
): NextResponse {
  return NextResponse.json(paidServiceUnavailableBody(reason), {
    status: 503,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
