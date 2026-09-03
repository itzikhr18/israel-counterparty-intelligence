import { z } from "zod";

const optionalCompanyNumber = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .describe("Israeli company number claimed by the buyer or invoice.")
  .optional();

const optionalCompanyName = z
  .string()
  .trim()
  .min(2)
  .max(200)
  .describe("Israeli legal or trading name claimed by the buyer or invoice.")
  .optional();

export const paymentRiskQuerySchema = z
  .object({
    company_number: optionalCompanyNumber,
    company_name: optionalCompanyName,
    invoice_company_number: optionalCompanyNumber.describe(
      "Company number printed on the invoice or payment request.",
    ),
    invoice_company_name: optionalCompanyName.describe(
      "Supplier name printed on the invoice or payment request.",
    ),
    invoice_city: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .describe("Supplier city printed on the invoice or payment request.")
      .optional(),
    invoice_website: z
      .url()
      .max(500)
      .describe("Supplier website presented in the transaction context.")
      .optional(),
    vendor_email: z
      .email()
      .max(320)
      .describe("Supplier contact email used for the payment request.")
      .optional(),
    invoice_amount: z
      .number()
      .finite()
      .positive()
      .max(1_000_000_000)
      .describe(
        "Optional invoice amount used as audit context, not as a credit signal.",
      )
      .optional(),
    invoice_currency: z
      .enum(["ILS", "USD", "EUR", "GBP", "USDC"])
      .describe("Optional invoice currency.")
      .optional(),
    payment_details_changed: z
      .boolean()
      .default(false)
      .describe(
        "Buyer-observed signal that payment instructions recently changed.",
      ),
    urgent_payment_request: z
      .boolean()
      .default(false)
      .describe(
        "Buyer-observed signal that unusual urgency was used to request payment.",
      ),
    first_time_vendor: z
      .boolean()
      .default(false)
      .describe(
        "Whether this is the buyer's first transaction with the vendor.",
      ),
    language: z.enum(["en", "he"]).default("en"),
  })
  .refine(
    (value) =>
      value.company_number ||
      value.company_name ||
      value.invoice_company_number ||
      value.invoice_company_name,
    {
      message:
        "Provide a company number or company name from the buyer or invoice context",
      path: ["company_number"],
    },
  )
  .refine(
    (value) =>
      value.invoice_company_number ||
      value.invoice_company_name ||
      value.invoice_city ||
      value.invoice_website ||
      value.vendor_email ||
      value.payment_details_changed ||
      value.urgent_payment_request ||
      value.first_time_vendor,
    {
      message: "Provide at least one invoice or payment-context signal",
      path: ["invoice_company_name"],
    },
  );

export type PaymentRiskQuery = z.infer<typeof paymentRiskQuerySchema>;

export const paymentRiskInputJsonSchema = {
  type: "object",
  properties: {
    company_number: {
      type: "string",
      minLength: 1,
      maxLength: 30,
      description: "Israeli company number supplied by the buyer.",
    },
    company_name: {
      type: "string",
      minLength: 2,
      maxLength: 200,
      description: "Israeli company name supplied by the buyer.",
    },
    invoice_company_number: {
      type: "string",
      minLength: 1,
      maxLength: 30,
      description: "Company number printed on the invoice or payment request.",
    },
    invoice_company_name: {
      type: "string",
      minLength: 2,
      maxLength: 200,
      description: "Supplier name printed on the invoice or payment request.",
    },
    invoice_city: { type: "string", minLength: 2, maxLength: 100 },
    invoice_website: { type: "string", maxLength: 500 },
    vendor_email: { type: "string", maxLength: 320 },
    invoice_amount: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1_000_000_000,
    },
    invoice_currency: {
      type: "string",
      enum: ["ILS", "USD", "EUR", "GBP", "USDC"],
    },
    payment_details_changed: { type: "boolean", default: false },
    urgent_payment_request: { type: "boolean", default: false },
    first_time_vendor: { type: "boolean", default: false },
    language: { type: "string", enum: ["en", "he"], default: "en" },
  },
  anyOf: [
    { required: ["company_number"] },
    { required: ["company_name"] },
    { required: ["invoice_company_number"] },
    { required: ["invoice_company_name"] },
  ],
  additionalProperties: false,
} as const;

export const paymentRiskOutputJsonSchema = {
  type: "object",
  properties: {
    request_id: { type: "string", format: "uuid" },
    assessment_version: { type: "string" },
    entity: { type: "object" },
    decision: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["PROCEED", "REVIEW", "BLOCK"] },
        automation_safe: { type: "boolean" },
        score: { type: "number", minimum: 0, maximum: 100 },
        level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reason_codes: { type: "array", items: { type: "string" } },
        explanation: { type: "string" },
      },
      required: [
        "action",
        "automation_safe",
        "score",
        "level",
        "confidence",
        "reason_codes",
        "explanation",
      ],
    },
    checks: { type: "array", items: { type: "object" } },
    evidence: { type: "array", items: { type: "object" } },
    checks_not_performed: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
    checked_at: { type: "string", format: "date-time" },
  },
  required: [
    "request_id",
    "assessment_version",
    "entity",
    "decision",
    "checks",
    "evidence",
    "checks_not_performed",
    "disclaimer",
    "checked_at",
  ],
  additionalProperties: false,
} as const;

export const paymentRiskExample = {
  request_id: "738be322-0d63-4e29-bbf6-bae43d9ddca9",
  assessment_version: "1.0.0",
  entity: {
    legal_name: "מנדיי. קום בע״מ",
    company_number: "514744887",
    status: "פעילה",
  },
  decision: {
    action: "PROCEED",
    automation_safe: true,
    score: 0,
    level: "LOW",
    confidence: 0.99,
    reason_codes: [],
    explanation:
      "The supplied vendor identity matches the checked public-registry record.",
  },
  checks: [
    {
      code: "INVOICE_COMPANY_NUMBER",
      status: "MATCH",
      severity: "INFO",
      claimed: "514744887",
      observed: "514744887",
    },
  ],
  evidence: [],
  checks_not_performed: [
    "bank_account_ownership",
    "invoice_authenticity",
    "sanctions_pep_ubo",
    "adverse_media",
  ],
  disclaimer:
    "Operational triage from public registry data and buyer-provided context; not a guarantee, bank-account verification, AML/KYB certification, legal, credit, or payment advice.",
  checked_at: "2026-09-03T00:00:00.000Z",
} as const;
