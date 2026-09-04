import { z } from "zod";

const nineDigits = z
  .string()
  .trim()
  .regex(/^\d{9}$/, "Must contain exactly nine digits");

const money = z.number().finite().min(0).max(1_000_000_000);

export const officialInvoiceVerificationSchema = z.object({
  status: z.enum(["MATCH", "MISMATCH", "NOT_FOUND", "ERROR"]),
  checked_at: z.iso.datetime(),
  supplier_vat_number: nineDigits.optional(),
  invoice_number: z.string().trim().min(1).max(100).optional(),
  allocation_number: nineDigits.optional(),
  amount_before_vat: money.optional(),
  vat_amount: money.optional(),
});

export const invoiceGateQuerySchema = z.object({
  supplier_company_number: nineDigits.describe(
    "Nine-digit Israeli supplier company or VAT number.",
  ),
  supplier_name: z.string().trim().min(2).max(200).optional(),
  buyer_vat_number: nineDigits.optional(),
  buyer_is_authorized_dealer: z
    .boolean()
    .describe(
      "Buyer-attested answer: whether the invoice recipient is an Israeli authorized dealer (osek murshe). Required for a definitive allocation-number applicability result above the threshold.",
    )
    .optional(),
  buyer_requested_allocation_number: z
    .boolean()
    .describe(
      "Buyer-attested answer: whether the buyer requested an allocation number for this invoice. Required for a definitive applicability result above the threshold.",
    )
    .optional(),
  invoice_number: z.string().trim().min(1).max(100),
  invoice_date: z.iso.date().refine((value) => value >= "2025-01-01", {
    message: "Invoice gate policy coverage begins on 2025-01-01",
  }),
  amount_before_vat: money.positive(),
  vat_amount: money,
  total_amount: money.positive(),
  currency: z.literal("ILS").default("ILS"),
  expected_vat_rate: z.union([z.literal(0), z.literal(18)]).default(18),
  allocation_number: nineDigits.optional(),
  official_verification: officialInvoiceVerificationSchema
    .describe(
      "Optional result obtained by the buyer through the Israel Tax Authority authenticated service. It is treated as buyer-attested, not independently authenticated by this API.",
    )
    .optional(),
  invoice_city: z.string().trim().min(2).max(100).optional(),
  invoice_website: z.url().max(500).optional(),
  vendor_email: z.email().max(320).optional(),
  payment_details_changed: z.boolean().default(false),
  urgent_payment_request: z.boolean().default(false),
  first_time_vendor: z.boolean().default(false),
  language: z.enum(["en", "he"]).default("en"),
});

export type InvoiceGateQuery = z.infer<typeof invoiceGateQuerySchema>;

export const invoiceGateInputJsonSchema = {
  type: "object",
  properties: {
    supplier_company_number: {
      type: "string",
      pattern: "^\\d{9}$",
      description: "Nine-digit Israeli supplier company or VAT number.",
    },
    supplier_name: { type: "string", minLength: 2, maxLength: 200 },
    buyer_vat_number: { type: "string", pattern: "^\\d{9}$" },
    buyer_is_authorized_dealer: {
      type: "boolean",
      description:
        "Buyer-attested authorized-dealer status. If omitted above the threshold, allocation applicability is UNKNOWN and payment is held.",
    },
    buyer_requested_allocation_number: {
      type: "boolean",
      description:
        "Buyer-attested confirmation that the buyer requested an allocation number. If omitted above the threshold, allocation applicability is UNKNOWN and payment is held.",
    },
    invoice_number: { type: "string", minLength: 1, maxLength: 100 },
    invoice_date: {
      type: "string",
      format: "date",
      description: "Invoice date. Policy coverage begins on 2025-01-01.",
    },
    amount_before_vat: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1_000_000_000,
    },
    vat_amount: { type: "number", minimum: 0, maximum: 1_000_000_000 },
    total_amount: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1_000_000_000,
    },
    currency: { type: "string", const: "ILS", default: "ILS" },
    expected_vat_rate: {
      type: "number",
      enum: [0, 18],
      default: 18,
      description:
        "Expected Israeli VAT rate; use zero only for a known zero-rated or exempt transaction.",
    },
    allocation_number: { type: "string", pattern: "^\\d{9}$" },
    official_verification: {
      type: "object",
      description:
        "Buyer-attested output from the authenticated Israel Tax Authority service; not independently authenticated by this API.",
      properties: {
        status: {
          type: "string",
          enum: ["MATCH", "MISMATCH", "NOT_FOUND", "ERROR"],
        },
        checked_at: { type: "string", format: "date-time" },
        supplier_vat_number: { type: "string", pattern: "^\\d{9}$" },
        invoice_number: { type: "string" },
        allocation_number: { type: "string", pattern: "^\\d{9}$" },
        amount_before_vat: { type: "number", minimum: 0 },
        vat_amount: { type: "number", minimum: 0 },
      },
      required: ["status", "checked_at"],
      additionalProperties: false,
    },
    invoice_city: { type: "string", minLength: 2, maxLength: 100 },
    invoice_website: { type: "string", format: "uri", maxLength: 500 },
    vendor_email: { type: "string", format: "email", maxLength: 320 },
    payment_details_changed: { type: "boolean", default: false },
    urgent_payment_request: { type: "boolean", default: false },
    first_time_vendor: { type: "boolean", default: false },
    language: { type: "string", enum: ["en", "he"], default: "en" },
  },
  required: [
    "supplier_company_number",
    "invoice_number",
    "invoice_date",
    "amount_before_vat",
    "vat_amount",
    "total_amount",
  ],
  additionalProperties: false,
} as const;

export const invoiceGateOutputJsonSchema = {
  type: "object",
  properties: {
    request_id: { type: "string", format: "uuid" },
    gate_version: { type: "string" },
    policy: { type: "object" },
    entity: { type: ["object", "null"] },
    decision: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["PAY", "HOLD", "BLOCK"] },
        automation_safe: { type: "boolean" },
        score: { type: "number", minimum: 0, maximum: 100 },
        reason_codes: { type: "array", items: { type: "string" } },
        explanation: { type: "string" },
      },
      required: [
        "action",
        "automation_safe",
        "score",
        "reason_codes",
        "explanation",
      ],
    },
    checks: { type: "array", items: { type: "object" } },
    official_verification: { type: "object" },
    evidence: { type: "array", items: { type: "object" } },
    checks_not_performed: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
    checked_at: { type: "string", format: "date-time" },
  },
  required: [
    "gate_version",
    "policy",
    "decision",
    "checks",
    "official_verification",
    "evidence",
    "checks_not_performed",
    "disclaimer",
    "checked_at",
  ],
  additionalProperties: true,
} as const;

export const invoiceGateExample = {
  gate_version: "1.1.0",
  policy: {
    allocation_threshold_ils: 5000,
    threshold_comparison: "strictly_greater_than",
    amount_exceeds_threshold: true,
    has_vat_component: true,
    buyer_is_authorized_dealer: true,
    buyer_requested_allocation_number: true,
    allocation_applicability: "REQUIRED",
    allocation_required: true,
    missing_inputs: [],
    policy_as_of: "2026-06-01",
    source_url:
      "https://www.gov.il/he/service/request-assignment-number-for-tax-invoice",
  },
  entity: {
    legal_name: "מנדיי. קום בע״מ",
    company_number: "514744887",
    status: "פעילה",
  },
  decision: {
    action: "HOLD",
    automation_safe: false,
    score: 35,
    reason_codes: ["OFFICIAL_ALLOCATION_VERIFICATION_REQUIRED"],
    explanation:
      "Hold payment until the allocation number is confirmed through the authenticated Israel Tax Authority service.",
  },
  checks: [],
  official_verification: {
    status: "NOT_PROVIDED",
    trust: "NONE",
    independently_authenticated: false,
  },
  evidence: [],
  checks_not_performed: ["bank_account_ownership"],
  disclaimer:
    "Decision support only. This API does not independently authenticate buyer-supplied Tax Authority verification results.",
  checked_at: "2026-09-04T00:00:00.000Z",
} as const;
