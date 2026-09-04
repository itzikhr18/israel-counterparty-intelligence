import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { invoiceGateQuerySchema } from "@/lib/invoice-gate-schema";
import {
  renderInvoicePreviewPage,
  type InvoicePreviewPageResult,
} from "@/lib/invoice-page";
import { previewInvoiceGate } from "@/lib/services/invoice-gate";

export const runtime = "nodejs";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function html(body: string, status = 200) {
  return new NextResponse(body, { status, headers: HTML_HEADERS });
}

function optionalText(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const parsed = invoiceGateQuerySchema.safeParse({
      supplier_company_number: optionalText(form, "supplier_company_number"),
      invoice_number: optionalText(form, "invoice_number"),
      invoice_date: optionalText(form, "invoice_date"),
      amount_before_vat: Number(optionalText(form, "amount_before_vat")),
      vat_amount: Number(optionalText(form, "vat_amount")),
      total_amount: Number(optionalText(form, "total_amount")),
      allocation_number: optionalText(form, "allocation_number"),
      expected_vat_rate: Number(optionalText(form, "expected_vat_rate") ?? 18),
      currency: "ILS",
      language: "en",
    });

    if (!parsed.success) {
      return html(
        renderInvoicePreviewPage({
          providerName: config.PROVIDER_NAME,
          error:
            "Check that all required fields are complete, amounts are valid, and company and allocation numbers contain exactly nine digits.",
        }),
        400,
      );
    }

    const preview = previewInvoiceGate(parsed.data);
    const result: InvoicePreviewPageResult = {
      action: preview.decision.action,
      score: preview.decision.score,
      reasonCodes: [...preview.decision.reason_codes],
      explanation: preview.decision.explanation,
      allocationRequired: preview.policy.allocation_required,
      allocationThresholdIls: preview.policy.allocation_threshold_ils,
      invoiceDate: parsed.data.invoice_date,
      amountBeforeVat: parsed.data.amount_before_vat,
      vatAmount: parsed.data.vat_amount,
      totalAmount: parsed.data.total_amount,
      checks: preview.checks.map((check) => ({
        code: check.code,
        status: check.status,
        claimed: check.claimed,
        observed: check.observed,
      })),
      checkedAt: preview.checked_at,
    };

    return html(
      renderInvoicePreviewPage({
        providerName: config.PROVIDER_NAME,
        result,
      }),
    );
  } catch {
    return html(
      renderInvoicePreviewPage({
        providerName: config.PROVIDER_NAME,
        error:
          "The invoice form could not be read. Please return and try again.",
      }),
      400,
    );
  }
}
