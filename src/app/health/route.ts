import { NextResponse } from "next/server";

import { API_VERSION } from "@/lib/domain";
import { paymentEnvironments } from "@/lib/config";
import {
  PAID_SERVICE_NOTICE,
  PAID_SERVICE_SUSPENDED,
} from "@/lib/service-availability";

export async function GET() {
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
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
