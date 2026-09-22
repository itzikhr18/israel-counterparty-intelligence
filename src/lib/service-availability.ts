import { NextResponse } from "next/server";

// Deliberately independent of x402 configuration: disabling payment verification
// must never reopen paid reports. This reviewed resume release sets suspended=false;
// re-suspend only via another reviewed code release (not by toggling X402_* alone).
export const PAID_SERVICE_SUSPENDED = false;

export const PAID_SERVICE_NOTICE =
  "Paid reports and x402 payments are temporarily suspended pending commercial-readiness review. Free previews remain available. Do not sign or send a payment.";

export function paidServiceUnavailableBody() {
  return {
    error: {
      code: "PAID_SERVICE_SUSPENDED",
      message: PAID_SERVICE_NOTICE,
    },
    payment_attempted: false,
  };
}

export function paidServiceUnavailableResponse(): NextResponse {
  return NextResponse.json(paidServiceUnavailableBody(), {
    status: 503,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
