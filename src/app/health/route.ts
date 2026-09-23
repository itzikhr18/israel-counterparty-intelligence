import { NextResponse } from "next/server";

import { API_VERSION } from "@/lib/domain";
import { paymentEnvironments } from "@/lib/config";
import { getFirstExternalPaidCallDurable } from "@/lib/payment-telemetry";
import {
  PAID_SERVICE_NOTICE,
  PAID_SERVICE_SUSPENDED,
} from "@/lib/service-availability";

function getSecondExternalPaidCallFromEnv() {
  const tx = process.env.SECOND_EXTERNAL_PAID_CALL_TX?.trim();
  if (!tx || !/^0x[a-fA-F0-9]{64}$/.test(tx)) return null;
  return {
    tx_hash: tx,
    resource:
      process.env.SECOND_EXTERNAL_PAID_CALL_RESOURCE?.trim() ||
      "https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet",
    route:
      process.env.SECOND_EXTERNAL_PAID_CALL_ROUTE?.trim() ||
      "/v1/verify/mainnet",
    network:
      process.env.SECOND_EXTERNAL_PAID_CALL_NETWORK?.trim() ||
      paymentEnvironments.mainnet.network,
    amount_usdc:
      process.env.SECOND_EXTERNAL_PAID_CALL_AMOUNT_USDC?.trim() || "0.050000",
    payer: process.env.SECOND_EXTERNAL_PAID_CALL_PAYER?.trim() || null,
    timestamp: process.env.SECOND_EXTERNAL_PAID_CALL_TIMESTAMP?.trim() || null,
    source: "env" as const,
    durable: true as const,
  };
}

export async function GET() {
  const firstExternalPaidCall = await getFirstExternalPaidCallDurable();
  const secondExternalPaidCall = getSecondExternalPaidCallFromEnv();
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
            : "In-process observation only; set FIRST_EXTERNAL_PAID_CALL_TX (or UPSTASH_REDIS_REST_*) for durable display across cold starts. Never self-pay from the receiving wallet."
          : "No external Mainnet settlement observed yet. Do not self-pay from the operator/receiving wallet.",
        optional_second_paid_call: {
          status: "available" as const,
          amount_usdc: "0.05",
          network: paymentEnvironments.mainnet.network,
          path: "/v1/verify/mainnet",
          resource_url:
            "https://israel-counterparty-intelligence.vercel.app/v1/verify/mainnet",
          method: "POST",
          atomic_amount: "50000",
          note: "Optional second Mainnet canary for PayAPI / repeat-settle demos alongside the $0.01 company-changes path.",
        },
        second_external_paid_call: secondExternalPaidCall,
        second_external_paid_call_note: secondExternalPaidCall
          ? undefined
          : "No second external Mainnet settlement recorded yet. Settle POST /v1/verify/mainnet ($0.05) to demonstrate a non-one-shot payment path. Persist with SECOND_EXTERNAL_PAID_CALL_TX after an external settle.",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
