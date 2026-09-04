import { createJsonHandler } from "@/lib/http/handler";
import { invoiceGateQuerySchema } from "@/lib/invoice-gate-schema";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/invoice-gate/mainnet",
  invoiceGateQuerySchema,
  (query) => counterpartyOrchestrator.invoiceGate(query),
);

export const POST = protectWithX402(handler, "invoice-gate-mainnet");
