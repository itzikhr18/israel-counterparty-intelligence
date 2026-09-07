import { NextResponse } from "next/server";

// Deliberately independent of x402 configuration: disabling payment verification
// must never reopen paid reports. Resumption requires a reviewed code release.
export const PAID_SERVICE_SUSPENDED = true;

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
