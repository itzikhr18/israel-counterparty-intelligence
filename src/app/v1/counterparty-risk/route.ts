import { counterpartyQuerySchema } from "@/lib/domain";
import { createJsonHandler } from "@/lib/http/handler";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/counterparty-risk",
  counterpartyQuerySchema,
  (query) => counterpartyOrchestrator.counterpartyRisk(query),
);

export const POST = protectWithX402(handler, "counterparty-risk");
