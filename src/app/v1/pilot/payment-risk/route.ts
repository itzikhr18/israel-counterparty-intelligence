import { paymentRiskQuerySchema } from "@/lib/payment-risk-schema";
import { createPilotRoute } from "@/lib/pilot";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

export const POST = createPilotRoute(
  "/v1/pilot/payment-risk",
  paymentRiskQuerySchema,
  "payment_risk",
  (query) => counterpartyOrchestrator.paymentRisk(query),
);
