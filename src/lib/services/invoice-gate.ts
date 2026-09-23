import type { Evidence, ResolvedEntity } from "@/lib/domain";
import type { InvoiceGateQuery } from "@/lib/invoice-gate-schema";
import { assessPaymentRisk } from "@/lib/services/payment-risk";
import {
  allocationPolicyWithContext,
  TAX_AUTHORITY_ALLOCATION_POLICY_URL,
} from "@/lib/policies/israel-allocation-policy";

export const INVOICE_GATE_VERSION = "1.1.0";
export const TAX_AUTHORITY_VERIFIER_URL =
  "https://www.gov.il/en/service/verify-vendor-invoice-information";
const MONEY_TOLERANCE = 0.02;

type GateCheckStatus = "MATCH" | "MISMATCH" | "PASS" | "MISSING" | "SIGNAL";

interface GateCheck {
  code: string;
  status: GateCheckStatus;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
  claimed: unknown;
  observed: unknown;
  points: number;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export {
  allocationPolicy,
  allocationPolicyWithContext,
  evaluateAllocationPolicy,
  TAX_AUTHORITY_ALLOCATION_POLICY_URL,
  POLICY_ID as ALLOCATION_POLICY_ID,
  POLICY_VERSION as ALLOCATION_POLICY_VERSION,
} from "@/lib/policies/israel-allocation-policy";

function policyForQuery(query: InvoiceGateQuery) {
  return allocationPolicyWithContext(
    query.invoice_date,
    query.amount_before_vat,
    {
      has_vat_component: query.vat_amount > 0,
      buyer_is_authorized_dealer: query.buyer_is_authorized_dealer,
      buyer_requested_allocation_number:
        query.buyer_requested_allocation_number,
    },
  );
}

function allocationContextChecks(
  query: InvoiceGateQuery,
  policy: ReturnType<typeof policyForQuery>,
): GateCheck[] {
  if (!policy.amount_exceeds_threshold || query.vat_amount <= 0) return [];
  const checks: GateCheck[] = [];
  for (const [code, value] of [
    ["BUYER_AUTHORIZED_DEALER", query.buyer_is_authorized_dealer],
    [
      "BUYER_REQUESTED_ALLOCATION_NUMBER",
      query.buyer_requested_allocation_number,
    ],
  ] as const) {
    checks.push({
      code,
      status: value === undefined ? "MISSING" : "PASS",
      severity: value === undefined ? "MEDIUM" : "INFO",
      claimed: value ?? null,
      observed: value === undefined ? "buyer_attestation_required" : value,
      points: value === undefined ? 20 : 0,
    });
  }
  return checks;
}

function invoiceChecks(query: InvoiceGateQuery): GateCheck[] {
  const expectedVat = roundMoney(
    (query.amount_before_vat * query.expected_vat_rate) / 100,
  );
  const expectedTotal = roundMoney(query.amount_before_vat + query.vat_amount);
  const vatMatches =
    Math.abs(query.vat_amount - expectedVat) <= MONEY_TOLERANCE;
  const totalMatches =
    Math.abs(query.total_amount - expectedTotal) <= MONEY_TOLERANCE;
  return [
    {
      code: "VAT_ARITHMETIC",
      status: vatMatches ? "MATCH" : "MISMATCH",
      severity: vatMatches ? "INFO" : "HIGH",
      claimed: query.vat_amount,
      observed: expectedVat,
      points: vatMatches ? 0 : 50,
    },
    {
      code: "INVOICE_TOTAL_ARITHMETIC",
      status: totalMatches ? "MATCH" : "MISMATCH",
      severity: totalMatches ? "INFO" : "HIGH",
      claimed: query.total_amount,
      observed: expectedTotal,
      points: totalMatches ? 0 : 50,
    },
  ];
}

function officialChecks(query: InvoiceGateQuery): GateCheck[] {
  const official = query.official_verification;
  if (!official) return [];
  const comparisons: Array<[string, unknown, unknown]> = [
    [
      "OFFICIAL_SUPPLIER_NUMBER",
      official.supplier_vat_number,
      query.supplier_company_number,
    ],
    ["OFFICIAL_INVOICE_NUMBER", official.invoice_number, query.invoice_number],
    [
      "OFFICIAL_ALLOCATION_NUMBER",
      official.allocation_number,
      query.allocation_number,
    ],
    [
      "OFFICIAL_AMOUNT_BEFORE_VAT",
      official.amount_before_vat,
      query.amount_before_vat,
    ],
    ["OFFICIAL_VAT_AMOUNT", official.vat_amount, query.vat_amount],
  ];
  return comparisons
    .filter(([, claimed]) => claimed !== undefined)
    .map(([code, claimed, observed]) => {
      const matches =
        typeof claimed === "number" && typeof observed === "number"
          ? Math.abs(claimed - observed) <= MONEY_TOLERANCE
          : claimed === observed;
      return {
        code,
        status: matches ? "MATCH" : "MISMATCH",
        severity: matches ? "INFO" : "HIGH",
        claimed,
        observed,
        points: matches ? 0 : 60,
      };
    });
}

export function previewInvoiceGate(query: InvoiceGateQuery, now = new Date()) {
  const policy = policyForQuery(query);
  const checks = [
    ...invoiceChecks(query),
    ...allocationContextChecks(query, policy),
  ];
  if (policy.allocation_required) {
    checks.push({
      code: "ALLOCATION_NUMBER_PRESENT",
      status: query.allocation_number ? "PASS" : "MISSING",
      severity: query.allocation_number ? "INFO" : "HIGH",
      claimed: query.allocation_number ?? null,
      observed: "required",
      points: query.allocation_number ? 0 : 70,
    });
  }
  const arithmeticMismatch = checks.some(
    (check) => check.status === "MISMATCH",
  );
  const missingAllocation =
    policy.allocation_required && !query.allocation_number;
  const allocationContextMissing =
    policy.allocation_applicability === "UNKNOWN";
  const action = arithmeticMismatch || missingAllocation ? "BLOCK" : "HOLD";
  const reasonCodes = [
    ...(arithmeticMismatch ? ["INVOICE_ARITHMETIC_MISMATCH"] : []),
    ...(missingAllocation ? ["ALLOCATION_NUMBER_REQUIRED"] : []),
    ...(allocationContextMissing
      ? ["ALLOCATION_REQUIREMENT_CONTEXT_MISSING"]
      : []),
    ...(!arithmeticMismatch && !missingAllocation && !allocationContextMissing
      ? ["PAID_REGISTRY_GATE_REQUIRED"]
      : []),
  ];
  return {
    gate_version: INVOICE_GATE_VERSION,
    preview: true,
    policy,
    entity: null,
    decision: {
      action,
      automation_safe: false,
      score: Math.min(
        100,
        checks.reduce((sum, check) => sum + check.points, 0),
      ),
      reason_codes: reasonCodes,
      explanation:
        action === "BLOCK"
          ? "Fix the invoice issues before payment."
          : allocationContextMissing
            ? "Hold payment until the buyer confirms authorized-dealer status and whether an allocation number was requested."
            : "The invoice arithmetic passed. Run the paid gate to resolve the supplier and obtain a payment decision.",
    },
    checks,
    official_verification: {
      status: query.official_verification?.status ?? "NOT_PROVIDED",
      trust: query.official_verification ? "BUYER_ATTESTED" : "NONE",
      independently_authenticated: false,
    },
    evidence: [],
    checks_not_performed: [
      "supplier_registry_resolution",
      "bank_account_ownership",
      "independent_tax_authority_authentication",
    ],
    disclaimer:
      "Free structural preview only; it is not authorization to pay and does not contact the Israel Tax Authority.",
    checked_at: now.toISOString(),
  } as const;
}

export function assessInvoiceGate(
  query: InvoiceGateQuery,
  entity: ResolvedEntity,
  resolutionConfidence: number,
  registryEvidence: Evidence[],
  now = new Date(),
) {
  const policy = policyForQuery(query);
  const paymentRisk = assessPaymentRisk(
    {
      company_number: query.supplier_company_number,
      company_name: query.supplier_name,
      invoice_company_number: query.supplier_company_number,
      invoice_company_name: query.supplier_name,
      invoice_city: query.invoice_city,
      invoice_website: query.invoice_website,
      vendor_email: query.vendor_email,
      invoice_amount: query.total_amount,
      invoice_currency: "ILS",
      payment_details_changed: query.payment_details_changed,
      urgent_payment_request: query.urgent_payment_request,
      first_time_vendor: query.first_time_vendor,
      language: query.language,
    },
    entity,
    resolutionConfidence,
    registryEvidence,
    now,
  );
  const checks: GateCheck[] = [
    ...invoiceChecks(query),
    ...allocationContextChecks(query, policy),
    ...officialChecks(query),
  ];
  if (policy.allocation_required) {
    checks.push({
      code: "ALLOCATION_NUMBER_PRESENT",
      status: query.allocation_number ? "PASS" : "MISSING",
      severity: query.allocation_number ? "INFO" : "HIGH",
      claimed: query.allocation_number ?? null,
      observed: "required",
      points: query.allocation_number ? 0 : 70,
    });
  }

  const reasons = new Set(paymentRisk.decision.reason_codes);
  const hardMismatch = checks.some((check) => check.status === "MISMATCH");
  const missingAllocation =
    policy.allocation_required && !query.allocation_number;
  const allocationContextMissing =
    policy.allocation_applicability === "UNKNOWN";
  const official = query.official_verification;
  const officialFailure =
    official?.status === "MISMATCH" || official?.status === "NOT_FOUND";
  const officialPending =
    policy.allocation_required &&
    Boolean(query.allocation_number) &&
    (!official || official.status === "ERROR");

  if (hardMismatch) reasons.add("INVOICE_OR_OFFICIAL_DATA_MISMATCH");
  if (missingAllocation) reasons.add("ALLOCATION_NUMBER_REQUIRED");
  if (allocationContextMissing)
    reasons.add("ALLOCATION_REQUIREMENT_CONTEXT_MISSING");
  if (officialFailure) reasons.add("OFFICIAL_ALLOCATION_VERIFICATION_FAILED");
  if (officialPending) reasons.add("OFFICIAL_ALLOCATION_VERIFICATION_REQUIRED");
  if (official?.status === "MATCH")
    reasons.add("BUYER_ATTESTED_OFFICIAL_MATCH");

  const action =
    hardMismatch ||
    missingAllocation ||
    officialFailure ||
    paymentRisk.decision.action === "BLOCK"
      ? "BLOCK"
      : allocationContextMissing ||
          officialPending ||
          paymentRisk.decision.action === "REVIEW"
        ? "HOLD"
        : "PAY";
  const score = Math.min(
    100,
    paymentRisk.decision.score +
      checks.reduce((sum, check) => sum + check.points, 0) +
      (officialPending ? 35 : 0),
  );
  const independentlyAuthenticated = false;
  const automationSafe =
    action === "PAY" &&
    paymentRisk.decision.automation_safe &&
    (!policy.allocation_required || independentlyAuthenticated);

  const decisionEvidence: Evidence = {
    field: "invoice_payment_gate_decision",
    value: { action, score, reason_codes: [...reasons] },
    type: "inference",
    source: "Israel Invoice Payment Gate deterministic rules",
    source_url: TAX_AUTHORITY_ALLOCATION_POLICY_URL,
    retrieved_at: now.toISOString(),
    source_record_id: `${entity.company_number}:${query.invoice_number}`,
    confidence: paymentRisk.decision.confidence,
    based_on: [
      ...checks.map((check) => check.code),
      ...paymentRisk.checks.map((check) => check.code),
    ],
    scoring_version: INVOICE_GATE_VERSION,
  };

  return {
    gate_version: INVOICE_GATE_VERSION,
    preview: false,
    policy,
    entity: {
      legal_name: entity.legal_name,
      company_number: entity.company_number,
      status: entity.status,
    },
    decision: {
      action,
      automation_safe: automationSafe,
      score,
      reason_codes: [...reasons],
      explanation:
        action === "PAY"
          ? automationSafe
            ? "The invoice passed the structural and supplier-registry gate."
            : "The invoice passed the supplied checks, but buyer-attested Tax Authority data was not independently authenticated; require buyer policy approval before automated payment."
          : action === "HOLD"
            ? "Hold payment until the missing official or supplier-risk review is completed."
            : "Block payment because a critical invoice, allocation, supplier, or verification check failed.",
    },
    checks: [...checks, ...paymentRisk.checks],
    official_verification: {
      status: official?.status ?? "NOT_PROVIDED",
      trust: official ? "BUYER_ATTESTED" : "NONE",
      checked_at: official?.checked_at ?? null,
      independently_authenticated: independentlyAuthenticated,
      limitation:
        "The official result is supplied by the buyer and is not cryptographically authenticated by this service. Direct verification requires an authorized Tax Authority connection.",
    },
    evidence: [...paymentRisk.evidence, decisionEvidence],
    checks_not_performed: [
      "bank_account_ownership",
      "invoice_document_forensics",
      "independent_tax_authority_authentication",
      "sanctions_pep_ubo",
      "creditworthiness",
    ],
    disclaimer:
      "Operational decision support, not a government confirmation, payment guarantee, AML/KYB certification, legal, tax, credit, or accounting advice.",
    checked_at: now.toISOString(),
  } as const;
}
