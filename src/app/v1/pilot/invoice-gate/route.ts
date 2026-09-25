import { invoiceGateQuerySchema } from "@/lib/invoice-gate-schema";
import { createPilotRoute } from "@/lib/pilot";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

export const POST = createPilotRoute(
  "/v1/pilot/invoice-gate",
  invoiceGateQuerySchema,
  "invoice_gate",
  (query) => counterpartyOrchestrator.invoiceGate(query),
);
