import { agentPaymentTrustQuerySchema } from "@/lib/agent-payment-trust-schema";
import { createJsonHandler } from "@/lib/http/handler";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

export const runtime = "nodejs";

export const POST = createJsonHandler(
  "/v1/agent-payment-trust",
  agentPaymentTrustQuerySchema,
  (query) => counterpartyOrchestrator.agentPaymentTrust(query),
);
