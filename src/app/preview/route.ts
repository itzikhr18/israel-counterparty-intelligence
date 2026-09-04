import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { previewCompanyQuerySchema } from "@/lib/domain";
import { renderPreviewPage, type PreviewPageResult } from "@/lib/landing";
import { counterpartyOrchestrator } from "@/lib/services/orchestrator";

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

export async function GET(request: NextRequest) {
  const companyNumber =
    request.nextUrl.searchParams.get("company_number")?.trim() ?? "";
  const parsed = previewCompanyQuerySchema.safeParse({
    company_number: companyNumber,
    language: "en",
  });

  if (!parsed.success || !/^\d{9}$/.test(companyNumber)) {
    return html(
      renderPreviewPage({
        providerName: config.PROVIDER_NAME,
        companyNumber,
        error: "Enter a valid nine-digit Israeli company number.",
      }),
      400,
    );
  }

  try {
    const verification = await counterpartyOrchestrator.verify({
      ...parsed.data,
      depth: "standard",
    });
    const resolved =
      verification.resolution_status === "RESOLVED"
        ? verification.resolved_entity
        : null;
    const result: PreviewPageResult = {
      resolutionStatus: verification.resolution_status,
      company: resolved
        ? {
            legalName: resolved.legal_name,
            companyNumber: resolved.company_number,
            status: resolved.status,
          }
        : null,
      candidates: verification.candidates.slice(0, 3).map((candidate) => ({
        legalName: candidate.legal_name,
        companyNumber: candidate.company_number,
        status: candidate.status,
      })),
      confidence: verification.confidence,
      checkedAt: verification.checked_at,
    };

    return html(
      renderPreviewPage({
        providerName: config.PROVIDER_NAME,
        companyNumber,
        result,
      }),
    );
  } catch {
    return html(
      renderPreviewPage({
        providerName: config.PROVIDER_NAME,
        companyNumber,
        error:
          "The registry source is temporarily unavailable. Please try again shortly.",
      }),
      503,
    );
  }
}
