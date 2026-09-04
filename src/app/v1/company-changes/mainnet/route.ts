import { companyChangesQuerySchema } from "@/lib/company-changes-schema";
import { createJsonHandler } from "@/lib/http/handler";
import { protectWithX402 } from "@/lib/payment";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

const handler = createJsonHandler(
  "/v1/company-changes/mainnet",
  companyChangesQuerySchema,
  (query) => counterpartyOrchestrator.companyChanges(query),
);

export const POST = protectWithX402(handler, "company-changes-mainnet");
