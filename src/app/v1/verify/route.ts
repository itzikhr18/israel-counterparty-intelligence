import { counterpartyQuerySchema } from "@/lib/domain";
import { createJsonHandler } from "@/lib/http/handler";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/verify",
  counterpartyQuerySchema,
  (query) => counterpartyOrchestrator.verify(query),
);

export const POST = protectWithX402(handler, "verify");
