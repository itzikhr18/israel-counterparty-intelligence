/**
 * Versioned Israel Tax Authority allocation-number applicability policy.
 *
 * Decision-support only: encodes public threshold/applicability rules for
 * Israeli tax invoices. This service does not call the Tax Authority, does not
 * independently authenticate buyer-supplied official results, and does not
 * guarantee VAT deduction or payment authorization. Public Tax Authority
 * pages linked below remain the authoritative rules source.
 */

export const POLICY_ID = "israel-allocation-v2026.06";
export const POLICY_VERSION = "2026.06";

export const TAX_AUTHORITY_ALLOCATION_POLICY_URL =
  "https://www.gov.il/he/service/request-assignment-number-for-tax-invoice" as const;

export type AllocationApplicability = "REQUIRED" | "NOT_REQUIRED" | "UNKNOWN";

export interface AllocationPolicyContext {
  has_vat_component?: boolean;
  buyer_is_authorized_dealer?: boolean;
  buyer_requested_allocation_number?: boolean;
}

export interface AllocationPolicyResult {
  policy_id: typeof POLICY_ID;
  policy_version: typeof POLICY_VERSION;
  allocation_threshold_ils: number;
  threshold_comparison: "strictly_greater_than";
  amount_exceeds_threshold: boolean;
  has_vat_component: boolean | null;
  buyer_is_authorized_dealer: boolean | null;
  buyer_requested_allocation_number: boolean | null;
  allocation_applicability: AllocationApplicability;
  allocation_required: boolean | null;
  missing_inputs: string[];
  policy_as_of: string;
  source_url: typeof TAX_AUTHORITY_ALLOCATION_POLICY_URL;
  note: string;
}

/** Threshold schedule by invoice date (inclusive lower bounds). */
export function thresholdIlsForInvoiceDate(invoiceDate: string): number {
  if (invoiceDate >= "2026-06-01") return 5_000;
  if (invoiceDate >= "2026-01-01") return 10_000;
  return 20_000;
}

export function policyAsOfForInvoiceDate(invoiceDate: string): string {
  if (invoiceDate >= "2026-06-01") return "2026-06-01";
  if (invoiceDate >= "2026-01-01") return "2026-01-01";
  return "2025-01-01";
}

/**
 * Evaluate allocation-number applicability.
 * Amount must be strictly greater than the date-sensitive threshold; a VAT
 * component, authorized-dealer buyer, and buyer request are also required for
 * REQUIRED. Missing buyer context above threshold fails safely to UNKNOWN.
 */
export function evaluateAllocationPolicy(
  invoiceDate: string,
  amountBeforeVat: number,
  context: AllocationPolicyContext = {},
): AllocationPolicyResult {
  const threshold = thresholdIlsForInvoiceDate(invoiceDate);
  const policyAsOf = policyAsOfForInvoiceDate(invoiceDate);
  const amountExceedsThreshold = amountBeforeVat > threshold;
  const missingInputs: string[] = [];
  if (amountExceedsThreshold && context.has_vat_component !== false) {
    if (context.has_vat_component === undefined)
      missingInputs.push("has_vat_component");
    if (context.buyer_is_authorized_dealer === undefined)
      missingInputs.push("buyer_is_authorized_dealer");
    if (context.buyer_requested_allocation_number === undefined)
      missingInputs.push("buyer_requested_allocation_number");
  }
  const allocationApplicability: AllocationApplicability =
    !amountExceedsThreshold ||
    context.has_vat_component === false ||
    context.buyer_is_authorized_dealer === false ||
    context.buyer_requested_allocation_number === false
      ? "NOT_REQUIRED"
      : missingInputs.length > 0
        ? "UNKNOWN"
        : "REQUIRED";
  return {
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    allocation_threshold_ils: threshold,
    threshold_comparison: "strictly_greater_than",
    amount_exceeds_threshold: amountExceedsThreshold,
    has_vat_component: context.has_vat_component ?? null,
    buyer_is_authorized_dealer: context.buyer_is_authorized_dealer ?? null,
    buyer_requested_allocation_number:
      context.buyer_requested_allocation_number ?? null,
    allocation_applicability: allocationApplicability,
    allocation_required:
      allocationApplicability === "REQUIRED"
        ? true
        : allocationApplicability === "NOT_REQUIRED"
          ? false
          : null,
    missing_inputs: missingInputs,
    policy_as_of: policyAsOf,
    source_url: TAX_AUTHORITY_ALLOCATION_POLICY_URL,
    note: "The amount before VAT must be strictly greater than the date-sensitive threshold. A mandatory allocation number also depends on a VAT component, an authorized-dealer buyer, and the buyer requesting the number. Tax rules can change. This is decision-support only: Israel Counterparty Intelligence does not call or independently authenticate the Tax Authority; the public Tax Authority services remain the authoritative rules source.",
  };
}

/** Back-compat wrapper used by the invoice gate and existing tests. */
export function allocationPolicy(
  invoiceDate: string,
  amountBeforeVat: number,
  context: AllocationPolicyContext = {},
) {
  return evaluateAllocationPolicy(invoiceDate, amountBeforeVat, context);
}

/** @deprecated Use evaluateAllocationPolicy; kept for call-site clarity. */
export function allocationPolicyWithContext(
  invoiceDate: string,
  amountBeforeVat: number,
  context: AllocationPolicyContext,
) {
  return evaluateAllocationPolicy(invoiceDate, amountBeforeVat, context);
}
