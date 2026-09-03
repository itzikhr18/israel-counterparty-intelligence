import { z } from "zod";

const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 20-byte EVM address");

const atomicAmountSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,77}$/, "Expected a positive integer in atomic units");

const assetSchema = z.union([evmAddressSchema, z.literal("native")]);

export const agentPayeeDestinationSchema = z.object({
  network: z.string().trim().min(3).max(100),
  asset: assetSchema,
  pay_to: evmAddressSchema,
});

export const agentPayeeManifestSchema = z.object({
  version: z.literal("0.1"),
  company_number: z.string().trim().min(1).max(30),
  legal_name: z.string().trim().min(2).max(200).optional(),
  service_origin: z.url().max(500),
  allowed_payments: z.array(agentPayeeDestinationSchema).min(1).max(50),
  issued_at: z.iso.datetime({ offset: true }),
  expires_at: z.iso.datetime({ offset: true }),
  signing_address: evmAddressSchema,
  signature: z
    .string()
    .regex(/^0x[0-9a-fA-F]{130}$/, "Expected a 65-byte EVM signature"),
});

export type AgentPayeeManifest = z.infer<typeof agentPayeeManifestSchema>;

export const agentPaymentTrustQuerySchema = z
  .object({
    company_number: z.string().trim().min(1).max(30).optional(),
    company_name: z.string().trim().min(2).max(200).optional(),
    service_url: z.url().max(500),
    payment: z.object({
      scheme: z.string().trim().min(1).max(50).default("exact"),
      network: z.string().trim().min(3).max(100),
      asset: assetSchema,
      amount: atomicAmountSchema,
      pay_to: evmAddressSchema,
      resource_url: z.url().max(500).optional(),
    }),
    manifest_mode: z.enum(["fetch", "inline", "none"]).default("fetch"),
    manifest: agentPayeeManifestSchema.optional(),
    mandate: z
      .object({
        max_amount: atomicAmountSchema.optional(),
        allowed_networks: z
          .array(z.string().trim().min(3).max(100))
          .max(20)
          .optional(),
        allowed_assets: z.array(assetSchema).max(20).optional(),
        allowed_pay_to: z.array(evmAddressSchema).max(50).optional(),
        allowed_company_numbers: z
          .array(z.string().trim().min(1).max(30))
          .max(50)
          .optional(),
      })
      .optional(),
    previous_payment_fingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, "Expected a SHA-256 hex fingerprint")
      .optional(),
    language: z.enum(["en", "he"]).default("en"),
  })
  .refine((value) => value.company_number || value.company_name, {
    message: "Provide company_number or company_name",
    path: ["company_number"],
  })
  .refine((value) => value.manifest_mode !== "inline" || value.manifest, {
    message: "manifest is required when manifest_mode is inline",
    path: ["manifest"],
  });

export type AgentPaymentTrustQuery = z.infer<
  typeof agentPaymentTrustQuerySchema
>;

export const agentPaymentTrustOutputSchema = z.object({
  assessment_version: z.string(),
  mode: z.literal("dry_run"),
  entity: z
    .object({
      legal_name: z.string(),
      company_number: z.string(),
      status: z.string(),
    })
    .nullable(),
  payment_fingerprint: z.string(),
  decision: z.object({
    action: z.enum(["ALLOW", "REVIEW", "DENY"]),
    automation_safe: z.boolean(),
    assurance_level: z.enum([
      "LEVEL_0_UNVERIFIED",
      "LEVEL_1_SIGNED",
      "LEVEL_2_REGISTRY",
    ]),
    reason_codes: z.array(z.string()),
    explanation: z.string(),
  }),
  checks: z.array(
    z.object({
      code: z.string(),
      status: z.enum(["PASS", "REVIEW", "FAIL", "NOT_CHECKED"]),
      claimed: z.unknown(),
      observed: z.unknown(),
    }),
  ),
  manifest: z.object({
    mode: z.enum(["fetch", "inline", "none"]),
    source_url: z.string().nullable(),
    fetched_from_service_domain: z.boolean(),
    signature_valid: z.boolean(),
    signing_payload: z.string().nullable(),
  }),
  limitations: z.array(z.string()),
  next_action: z.object({
    proceed_to_payment: z.boolean(),
    human_review_required: z.boolean(),
    reason: z.string(),
  }),
  checked_at: z.string(),
});

export const agentPaymentTrustInputJsonSchema = z.toJSONSchema(
  agentPaymentTrustQuerySchema,
);
export const agentPaymentTrustOutputJsonSchema = z.toJSONSchema(
  agentPaymentTrustOutputSchema,
);
