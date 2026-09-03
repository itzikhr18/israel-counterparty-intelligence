import { counterpartyQuerySchema } from "@/lib/domain";
import { createJsonHandler } from "@/lib/http/handler";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/government-footprint",
  counterpartyQuerySchema,
  (query) => counterpartyOrchestrator.governmentFootprint(query),
);

export const POST = protectWithX402(handler, "government-footprint");
