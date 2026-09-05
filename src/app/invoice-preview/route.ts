import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { invoiceGateQuerySchema } from "@/lib/invoice-gate-schema";
import { logInvoiceFunnel } from "@/lib/invoice-funnel-telemetry";
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

function optionalBoolean(form: FormData, name: string): boolean | undefined {
  const value = optionalText(form, name);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const download = form.get("action") === "download";
    const requestJson = optionalText(form, "invoice_request");
    if (requestJson && requestJson.length > 65_536)
      throw new Error("Request too large");
    const parsed = invoiceGateQuerySchema.safeParse(
      download
        ? JSON.parse(requestJson ?? "null")
        : {
            supplier_company_number: optionalText(
              form,
              "supplier_company_number",
            ),
            buyer_is_authorized_dealer: optionalBoolean(
              form,
              "buyer_is_authorized_dealer",
            ),
            buyer_requested_allocation_number: optionalBoolean(
              form,
              "buyer_requested_allocation_number",
            ),
            invoice_number: optionalText(form, "invoice_number"),
            invoice_date: optionalText(form, "invoice_date"),
            amount_before_vat: Number(optionalText(form, "amount_before_vat")),
            vat_amount: Number(optionalText(form, "vat_amount")),
            total_amount: Number(optionalText(form, "total_amount")),
            allocation_number: optionalText(form, "allocation_number"),
            expected_vat_rate: Number(
              optionalText(form, "expected_vat_rate") ?? 18,
            ),
            currency: "ILS",
            language: "en",
          },
    );

    if (!parsed.success) {
      logInvoiceFunnel(request, "invoice_preview_invalid");
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
    const outcome = {
      action: preview.decision.action,
      allocationApplicability: preview.policy.allocation_applicability,
    };
    if (download) {
      if (
        preview.decision.action === "BLOCK" ||
        preview.policy.allocation_applicability === "UNKNOWN"
      ) {
        logInvoiceFunnel(request, "invoice_download_blocked", outcome);
        return html(
          renderInvoicePreviewPage({
            providerName: config.PROVIDER_NAME,
            error:
              "Correct the invoice and complete buyer answers before continuing to the paid gate.",
          }),
          409,
        );
      }
      logInvoiceFunnel(request, "invoice_request_downloaded", outcome);
      return new NextResponse(JSON.stringify(parsed.data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="invoice-request.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    logInvoiceFunnel(request, "invoice_preview_delivered", outcome);
    const result: InvoicePreviewPageResult = {
      action: preview.decision.action,
      score: preview.decision.score,
      reasonCodes: [...preview.decision.reason_codes],
      explanation: preview.decision.explanation,
      allocationRequired: preview.policy.allocation_required,
      allocationApplicability: preview.policy.allocation_applicability,
      allocationMissingInputs: [...preview.policy.missing_inputs],
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
        invoiceRequest: parsed.data,
      }),
    );
  } catch {
    logInvoiceFunnel(request, "invoice_preview_invalid");
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
