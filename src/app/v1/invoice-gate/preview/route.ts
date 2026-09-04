import { createJsonHandler } from "@/lib/http/handler";
import { invoiceGateQuerySchema } from "@/lib/invoice-gate-schema";
import { previewInvoiceGate } from "@/lib/services/invoice-gate";

export const POST = createJsonHandler(
  "/v1/invoice-gate/preview",
  invoiceGateQuerySchema,
  async (query) => previewInvoiceGate(query),
);
