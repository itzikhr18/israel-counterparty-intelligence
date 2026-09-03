import type { Evidence, ResolvedEntity } from "@/lib/domain";
import {
  normalizeCompanyNumber,
  normalizeName,
  nameSimilarity,
} from "@/lib/normalize";
import type { PaymentRiskQuery } from "@/lib/payment-risk-schema";
import { scoreRisk } from "@/lib/services/risk-scoring";

export const PAYMENT_RISK_ASSESSMENT_VERSION = "1.0.0";

type CheckStatus = "MATCH" | "PARTIAL" | "MISMATCH" | "SIGNAL" | "NOT_PROVIDED";
type CheckSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH";

export interface PaymentRiskCheck {
  code: string;
  status: CheckStatus;
  severity: CheckSeverity;
  claimed: unknown;
  observed: unknown;
  points: number;
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "walla.co.il",
]);

function hostname(value: string): string | null {
  try {
    return new URL(value).hostname
      .toLocaleLowerCase("en")
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

function emailDomain(value: string): string {
  return value.split("@").at(-1)?.toLocaleLowerCase("en") ?? "";
}

function domainsMatch(left: string, right: string): boolean {
  return (
    left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
  );
}

function addCheck(
  checks: PaymentRiskCheck[],
  code: string,
  status: CheckStatus,
  severity: CheckSeverity,
  claimed: unknown,
  observed: unknown,
  points = 0,
): void {
  checks.push({ code, status, severity, claimed, observed, points });
}

export function assessPaymentRisk(
  query: PaymentRiskQuery,
  entity: ResolvedEntity,
  resolutionConfidence: number,
  registryEvidence: Evidence[],
  now = new Date(),
) {
  const checks: PaymentRiskCheck[] = [];
  const base = scoreRisk(entity, resolutionConfidence, now);
  let score = base.risk.score ?? 0;
  const reasons = new Set(base.risk.reason_codes);

  if (query.invoice_company_number) {
    const claimed = normalizeCompanyNumber(query.invoice_company_number);
    const matches = claimed === entity.company_number;
    const points = matches ? 0 : 60;
    addCheck(
      checks,
      "INVOICE_COMPANY_NUMBER",
      matches ? "MATCH" : "MISMATCH",
      matches ? "INFO" : "HIGH",
      claimed ?? query.invoice_company_number,
      entity.company_number,
      points,
    );
    if (!matches) reasons.add("INVOICE_COMPANY_NUMBER_MISMATCH");
    score += points;
  } else {
    addCheck(
      checks,
      "INVOICE_COMPANY_NUMBER",
      "NOT_PROVIDED",
      "LOW",
      null,
      entity.company_number,
    );
  }

  if (query.invoice_company_name) {
    const similarity = nameSimilarity(
      query.invoice_company_name,
      entity.legal_name,
    );
    const status =
      similarity >= 0.9 ? "MATCH" : similarity >= 0.72 ? "PARTIAL" : "MISMATCH";
    const points = status === "MISMATCH" ? 30 : status === "PARTIAL" ? 20 : 0;
    addCheck(
      checks,
      "INVOICE_COMPANY_NAME",
      status,
      status === "MISMATCH" ? "HIGH" : status === "PARTIAL" ? "MEDIUM" : "INFO",
      query.invoice_company_name,
      entity.legal_name,
      points,
    );
    if (status === "MISMATCH") reasons.add("INVOICE_COMPANY_NAME_MISMATCH");
    if (status === "PARTIAL") reasons.add("INVOICE_COMPANY_NAME_PARTIAL_MATCH");
    score += points;
  } else {
    addCheck(
      checks,
      "INVOICE_COMPANY_NAME",
      "NOT_PROVIDED",
      "LOW",
      null,
      entity.legal_name,
    );
  }

  if (query.invoice_city) {
    const observed = entity.registered_address?.city ?? null;
    const matches = observed
      ? normalizeName(query.invoice_city) === normalizeName(observed)
      : null;
    const status =
      matches === null ? "NOT_PROVIDED" : matches ? "MATCH" : "MISMATCH";
    const points = status === "MISMATCH" ? 15 : 0;
    addCheck(
      checks,
      "INVOICE_CITY",
      status,
      status === "MISMATCH" ? "MEDIUM" : status === "MATCH" ? "INFO" : "LOW",
      query.invoice_city,
      observed,
      points,
    );
    if (status === "MISMATCH") reasons.add("INVOICE_CITY_MISMATCH");
    score += points;
  }

  if (query.vendor_email) {
    const email = emailDomain(query.vendor_email);
    const website = query.invoice_website
      ? hostname(query.invoice_website)
      : null;
    if (FREE_EMAIL_DOMAINS.has(email)) {
      addCheck(
        checks,
        "VENDOR_EMAIL_DOMAIN",
        "SIGNAL",
        "MEDIUM",
        email,
        website,
        10,
      );
      reasons.add("FREE_EMAIL_DOMAIN");
      score += 10;
    } else if (website) {
      const matches = domainsMatch(email, website);
      const points = matches ? 0 : 20;
      addCheck(
        checks,
        "VENDOR_EMAIL_DOMAIN",
        matches ? "MATCH" : "MISMATCH",
        matches ? "INFO" : "HIGH",
        email,
        website,
        points,
      );
      if (!matches) reasons.add("EMAIL_WEBSITE_DOMAIN_MISMATCH");
      score += points;
    } else {
      addCheck(
        checks,
        "VENDOR_EMAIL_DOMAIN",
        "NOT_PROVIDED",
        "LOW",
        email,
        null,
      );
    }
  }

  if (query.payment_details_changed) {
    addCheck(
      checks,
      "PAYMENT_DETAILS_CHANGED",
      "SIGNAL",
      "HIGH",
      true,
      null,
      25,
    );
    reasons.add("PAYMENT_DETAILS_CHANGED");
    score += 25;
  }
  if (query.urgent_payment_request) {
    addCheck(
      checks,
      "URGENT_PAYMENT_REQUEST",
      "SIGNAL",
      "MEDIUM",
      true,
      null,
      20,
    );
    reasons.add("URGENT_PAYMENT_REQUEST");
    score += 20;
  }
  if (query.first_time_vendor) {
    addCheck(checks, "FIRST_TIME_VENDOR", "SIGNAL", "LOW", true, null, 5);
    reasons.add("FIRST_TIME_VENDOR");
    score += 5;
  }

  score = Math.min(100, score);
  const confidencePenalty = checks.some(
    (check) => check.status === "NOT_PROVIDED",
  )
    ? 0.08
    : 0;
  const confidence = Number(
    Math.max(0, resolutionConfidence - confidencePenalty).toFixed(3),
  );
  const critical =
    reasons.has("ENTITY_NOT_ACTIVE") ||
    reasons.has("INVOICE_COMPANY_NUMBER_MISMATCH");
  const missingInvoiceIdentity =
    !query.invoice_company_number && !query.invoice_company_name;
  const action =
    critical || score >= 50
      ? "BLOCK"
      : score >= 20 || confidence < 0.85 || missingInvoiceIdentity
        ? "REVIEW"
        : "PROCEED";
  const automationSafe = action === "PROCEED" && confidence >= 0.85;
  const level = score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";

  const assessmentEvidence: Evidence = {
    field: "payment_risk_decision",
    value: { action, score, reason_codes: [...reasons] },
    type: "inference",
    source: "Israel Counterparty Intelligence payment-risk rules",
    source_url: null,
    retrieved_at: now.toISOString(),
    source_record_id: entity.company_number,
    confidence,
    based_on: checks.map((check) => check.code),
    scoring_version: PAYMENT_RISK_ASSESSMENT_VERSION,
  };

  return {
    assessment_version: PAYMENT_RISK_ASSESSMENT_VERSION,
    entity,
    decision: {
      action,
      automation_safe: automationSafe,
      score,
      level,
      confidence,
      reason_codes: [...reasons],
      explanation:
        reasons.size === 0
          ? "The supplied vendor identity matches the checked public-registry record."
          : `The decision reflects these registry and buyer-context signals: ${[...reasons].join(", ")}.`,
    },
    checks,
    evidence: [...registryEvidence, base.evidence, assessmentEvidence],
    checks_not_performed: [
      "bank_account_ownership",
      "invoice_authenticity",
      "sanctions_pep_ubo",
      "adverse_media",
      "creditworthiness",
    ],
    disclaimer:
      "Operational triage from public registry data and buyer-provided context; not a guarantee, bank-account verification, AML/KYB certification, legal, credit, or payment advice.",
    checked_at: now.toISOString(),
  } as const;
}
