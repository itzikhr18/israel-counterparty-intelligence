import { NextResponse } from "next/server";

import { API_VERSION } from "@/lib/domain";
import { paymentEnvironments } from "@/lib/config";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      payments: {
        mainnet_facilitator: paymentEnvironments.mainnet.facilitatorProvider,
        mainnet_network: paymentEnvironments.mainnet.network,
        receiving_wallet: paymentEnvironments.mainnet.payTo,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
