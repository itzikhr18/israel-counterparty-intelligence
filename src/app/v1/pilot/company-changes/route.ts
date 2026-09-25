import { companyChangesQuerySchema } from "@/lib/company-changes-schema";
import { createPilotRoute } from "@/lib/pilot";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

export const POST = createPilotRoute(
  "/v1/pilot/company-changes",
  companyChangesQuerySchema,
  "company_changes",
  (query) => counterpartyOrchestrator.companyChanges(query),
);
