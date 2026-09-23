import { NextResponse } from "next/server";

import { API_VERSION } from "@/lib/domain";
import { paymentEnvironments } from "@/lib/config";
import { getFirstExternalPaidCall } from "@/lib/payment-telemetry";
import {
  PAID_SERVICE_NOTICE,
  PAID_SERVICE_SUSPENDED,
} from "@/lib/service-availability";

export async function GET() {
  const firstExternalPaidCall = getFirstExternalPaidCall();
  return NextResponse.json(
    {
      status: "ok",
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      payments: {
        status: PAID_SERVICE_SUSPENDED ? "suspended" : "configured",
        paid_service_suspended: PAID_SERVICE_SUSPENDED,
        notice: PAID_SERVICE_SUSPENDED ? PAID_SERVICE_NOTICE : undefined,
        mainnet_facilitator: paymentEnvironments.mainnet.facilitatorProvider,
        mainnet_network: paymentEnvironments.mainnet.network,
        receiving_wallet: paymentEnvironments.mainnet.payTo,
        first_external_paid_call: firstExternalPaidCall,
        first_external_paid_call_note: firstExternalPaidCall
          ? firstExternalPaidCall.durable
            ? undefined
            : "In-process observation only; set FIRST_EXTERNAL_PAID_CALL_TX for durable display across cold starts."
          : "No external Mainnet settlement observed yet. Do not self-pay from the operator wallet.",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
