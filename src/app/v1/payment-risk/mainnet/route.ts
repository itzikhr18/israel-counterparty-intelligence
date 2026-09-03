import { createJsonHandler } from "@/lib/http/handler";
import { paymentRiskQuerySchema } from "@/lib/payment-risk-schema";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/payment-risk/mainnet",
  paymentRiskQuerySchema,
  (query) => counterpartyOrchestrator.paymentRisk(query),
);

export const POST = protectWithX402(handler, "payment-risk-mainnet");
