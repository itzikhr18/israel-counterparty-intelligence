import { counterpartyQuerySchema } from "@/lib/domain";
import { createPilotRoute } from "@/lib/pilot";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

export const POST = createPilotRoute(
  "/v1/pilot/verify",
  counterpartyQuerySchema,
  "verify",
  (query) => counterpartyOrchestrator.verify(query),
);
